-- Logging an activity grants a branch point on the client before it syncs, which
-- the stat-allocation check rejected as cheating, so activities were never saved.
-- The check now expects that extra point in the activity's branch.

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
  v_stats jsonb := p_data->'stats';
  v_branch_points jsonb := p_data->'branchPoints';
  v_new_activity jsonb := p_data->'newActivityLogged';
  activity_branch text;
  expected jsonb;
  decay_applied boolean;
  new_xp int;
  growth record;
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

  if v_stats is not null and v_branch_points is not null
     and not public.is_valid_stat_allocation(expected, v_stats, v_branch_points) then
    raise exception 'Asignación de puntos inválida detectada.' using errcode = 'P0001';
  end if;

  if v_new_activity is not null then
    insert into public.activities (character_id, type, xp_earned)
    values (c.id, v_new_activity->>'type', coalesce((v_new_activity->>'xpEarned')::int, 50));
  end if;

  decay_applied := public.apply_inactivity_rules(c.id);
  select * into c from public.characters where id = c.id;

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
    activities_today = case when p_data ? 'activitiesToday'
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
