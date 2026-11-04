-- Fixes from the review of the Supabase migration:
-- * a save carrying only stats or only branch points skipped the allocation check;
-- * stats below 5 or negative branch points could move value between stats;
-- * the same activity could be logged again and again for free points;
-- * stats changed by decay or recovery were overwritten by the client's older copy.

-- Moving points between the two stats of a branch, or spending unspent points,
-- keeps each branch's total. Stats never drop below 5 and points below 0.
create or replace function public.is_valid_stat_allocation(p_old jsonb, p_stats jsonb, p_branch_points jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select bool_and(
    (select sum(coalesce(nullif((p_old->>k)::int, 0), 5)) from unnest(keys) k) + coalesce((p_old->'branchPoints'->>branch)::int, 0)
      = (select sum(coalesce(nullif((p_stats->>k)::int, 0), 5)) from unnest(keys) k) + coalesce((p_branch_points->>branch)::int, 0)
    and (select bool_and(coalesce((p_stats->>k)::int, 5) >= 5) from unnest(keys) k)
    and coalesce((p_branch_points->>branch)::int, 0) >= 0
  )
  from (values
    ('strength', array['strength', 'resistance']),
    ('dexterity', array['dexterity', 'speed']),
    ('intelligence', array['intelligence', 'maxMana']),
    ('willpower', array['willpower', 'charisma'])
  ) as b(branch, keys);
$$;

-- Saves progress the client tracks (xp, moral, stat allocation, hero panel data)
-- and applies level-ups. Returns { character, blockedLevelUp, requiredStatValue, decayApplied }.
create or replace function public.sync_character(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  v_stats jsonb := nullif(p_data->'stats', 'null'::jsonb);
  v_branch_points jsonb := nullif(p_data->'branchPoints', 'null'::jsonb);
  v_new_activity jsonb := nullif(p_data->'newActivityLogged', 'null'::jsonb);
  activity_branch text;
  expected jsonb;
  decay_applied boolean;
  new_xp int;
  growth record;
  stats_before jsonb;
begin
  c := public.my_character_for_update();

  -- A newly logged activity grants one unspent point in its branch
  if v_new_activity is not null then
    activity_branch := case v_new_activity->>'type'
      when 'strength' then 'strength'
      when 'intense' then 'dexterity'
      when 'cardio' then 'dexterity'
      when 'running' then 'dexterity'
      when 'study' then 'intelligence'
      when 'reading' then 'intelligence'
      when 'meditation' then 'willpower'
      when 'social' then 'willpower'
    end;
    if activity_branch is null then
      raise exception 'Actividad desconocida.' using errcode = 'P0001';
    end if;
  end if;

  -- What the totals should be: the stored character plus that new point
  expected := public.character_json(c);
  if activity_branch is not null then
    expected := jsonb_set(expected, array['branchPoints', activity_branch],
      to_jsonb(coalesce((expected->'branchPoints'->>activity_branch)::int, 0) + 1));
  end if;

  -- A save with only stats or only points is checked against the stored other half
  if v_stats is not null or v_branch_points is not null then
    v_stats := coalesce(v_stats, expected);
    v_branch_points := coalesce(v_branch_points, expected->'branchPoints');
    if not public.is_valid_stat_allocation(expected, v_stats, v_branch_points) then
      raise exception 'Asignación de puntos inválida detectada.' using errcode = 'P0001';
    end if;
  end if;

  -- Each activity counts once per day (UTC), as the game shows it
  if v_new_activity is not null and exists (
    select 1 from public.activities
    where character_id = c.id and type = v_new_activity->>'type'
      and logged_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
  ) then
    raise exception 'Ya registraste esta actividad hoy.' using errcode = 'P0001';
  end if;

  if v_new_activity is not null then
    insert into public.activities (character_id, type, xp_earned)
    values (c.id, v_new_activity->>'type', coalesce((v_new_activity->>'xpEarned')::int, 50));
  end if;

  stats_before := public.character_json(c);
  decay_applied := public.apply_inactivity_rules(c.id);
  select * into c from public.characters where id = c.id;

  -- Decay, the inactivity penalty or the end of recovery just changed the stats:
  -- keep those over the client's copy, which predates them
  if (select bool_or(stats_before->k is distinct from public.character_json(c)->k)
      from unnest(array['strength', 'resistance', 'dexterity', 'speed', 'intelligence', 'maxMana', 'willpower', 'charisma']) k) then
    v_stats := null;
    v_branch_points := null;
  end if;

  new_xp := coalesce((p_data->>'xp')::int, c.xp);
  growth := public.compute_level_up(c.level, new_xp, coalesce(v_stats, public.character_json(c)));

  update public.characters set
    xp = new_xp,
    moral = coalesce((p_data->>'moral')::int, moral),
    level = growth.level,
    last_activity_at = case when v_new_activity is not null then now() else last_activity_at end,
    strength = coalesce((v_stats->>'strength')::int, strength),
    resistance = coalesce((v_stats->>'resistance')::int, resistance),
    dexterity = coalesce((v_stats->>'dexterity')::int, dexterity),
    speed = coalesce((v_stats->>'speed')::int, speed),
    intelligence = coalesce((v_stats->>'intelligence')::int, intelligence),
    max_mana = coalesce((v_stats->>'maxMana')::int, max_mana),
    willpower = coalesce((v_stats->>'willpower')::int, willpower),
    charisma = coalesce((v_stats->>'charisma')::int, charisma),
    branch_points = branch_points || coalesce(v_branch_points, expected->'branchPoints'),
    -- chestCooldowns are server-owned: keep ours whatever the client sends
    activities_today = case when jsonb_typeof(p_data->'activitiesToday') = 'object'
      then activities_today || (p_data->'activitiesToday')
        || jsonb_build_object('chestCooldowns', coalesce(activities_today->'chestCooldowns', '{}'))
      else activities_today end
  where id = c.id
  returning * into c;

  return jsonb_build_object(
    'character', public.character_json(c),
    'blockedLevelUp', growth.blocked,
    'requiredStatValue', 5 + c.level,
    'decayApplied', decay_applied
  );
end;
$$;
