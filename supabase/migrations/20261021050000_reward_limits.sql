-- Simple limits on rewards the server cannot verify, because combat and
-- chest placement happen in the browser:
-- * XP never goes down and is paid from a budget that refills 10 per second up to 2000;
-- * at most 60 kills a minute earn loot, and a boss pays 150 gold once every 2 minutes;
-- * chests must be on the map: Deeproot's fixed spots, or inside the guild or the
--   cave with no more open cooldowns there than the map has chests.

alter table public.characters
  add column if not exists last_synced_at timestamptz not null default now(),
  add column if not exists xp_budget int not null default 500,
  add column if not exists kill_window_start timestamptz not null default now(),
  add column if not exists kill_window_count int not null default 0,
  add column if not exists last_boss_reward_at timestamptz;

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
  v_xp_budget int;
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

  -- XP never goes down and is paid from a budget that refills as fast as the
  -- game can hand XP out, so repeated saves cannot mint more
  v_xp_budget := least(2000, c.xp_budget + 10 * extract(epoch from now() - c.last_synced_at)::int);
  new_xp := least(greatest(coalesce((p_data->>'xp')::int, c.xp), c.xp), c.xp + v_xp_budget);
  v_xp_budget := v_xp_budget - (new_xp - c.xp);
  growth := public.compute_level_up(c.level, new_xp, coalesce(v_stats, public.character_json(c)));

  update public.characters set
    xp = new_xp,
    last_synced_at = now(),
    xp_budget = v_xp_budget,
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

-- Returns { character, goldDrop, droppedItem }
create or replace function public.enemy_killed(p_enemy_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  name_lower text := lower(p_enemy_name);
  is_boss boolean := name_lower like '%boss%' or name_lower like '%reina%' or name_lower like '%rey%';
  gold_drop int := floor(random() * 3)::int + 1;
  dropped_item jsonb;
begin
  c := public.my_character_for_update();

  -- Count kills per minute; past the limit they still count for the game but earn nothing
  if now() - c.kill_window_start > interval '1 minute' then
    c.kill_window_start := now();
    c.kill_window_count := 0;
  end if;
  c.kill_window_count := c.kill_window_count + 1;

  if c.kill_window_count > 60 then
    gold_drop := 0;
  elsif is_boss then
    if c.last_boss_reward_at is null or now() - c.last_boss_reward_at >= interval '2 minutes' then
      gold_drop := 150;
      c.last_boss_reward_at := now();
    end if;
  end if;

  if gold_drop > 0 and random() < 0.6 then
    if name_lower like '%slime%' then
      dropped_item := '{"id": "quest_slime_jelly", "name": "Gelatina de Slime", "icon": "🟢", "type": "quest"}';
    elsif name_lower like '%goblin%' then
      dropped_item := '{"id": "quest_goblin_tooth", "name": "Diente de Goblin", "icon": "🦷", "type": "quest"}';
    end if;
  end if;

  update public.characters set
    gold = gold + gold_drop,
    inventory = case when dropped_item is null then inventory else public.inventory_add(inventory, dropped_item) end,
    kill_window_start = c.kill_window_start,
    kill_window_count = c.kill_window_count,
    last_boss_reward_at = c.last_boss_reward_at
  where id = c.id
  returning * into c;

  return jsonb_build_object(
    'character', public.character_json(c),
    'goldDrop', gold_drop,
    'droppedItem', case when dropped_item is null then null else dropped_item || '{"count": 1}' end
  );
end;
$$;

-- Returns { character, goldDrop, cooldownUntil }; each chest refills after 20 minutes
create or replace function public.open_chest(p_map_id text, p_x int, p_y int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  chest_key text := p_map_id || '_' || p_x || '_' || p_y;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  cooldown_until bigint := now_ms + 20 * 60 * 1000;
  -- Only cooldowns still running; expired ones are dropped when saving
  cooldowns jsonb;
  chest_exists boolean;
  gold_drop int;
begin
  c := public.my_character_for_update();

  select coalesce(jsonb_object_agg(key, value), '{}') into cooldowns
  from jsonb_each(coalesce(c.activities_today->'chestCooldowns', '{}'))
  where value::text::bigint > now_ms;

  if cooldowns ? chest_key then
    raise exception 'El cofre está en cooldown.' using errcode = 'P0001';
  end if;

  -- Deeproot's chests sit on fixed spots (DEEPROOT_CHEST_SPOTS in src/utils/deeprootLayout.js);
  -- the guild and the cave place theirs at random, so only the map size and count are known
  chest_exists := case p_map_id
    when 'deeproot' then (p_x, p_y) in ((41, 7), (16, 18), (4, 21), (25, 26), (55, 31), (50, 33))
    when 'guild' then p_x between 0 and 39 and p_y between 0 and 29
      and (select count(*) from jsonb_object_keys(cooldowns) k where k like 'guild\_%') < 4
    when 'cueva_goblin' then p_x between 0 and 59 and p_y between 0 and 44
      and (select count(*) from jsonb_object_keys(cooldowns) k where k like 'cueva\_goblin\_%') < 5
    else false
  end;
  if not chest_exists then
    raise exception 'No hay ningún cofre ahí.' using errcode = 'P0001';
  end if;

  gold_drop := case p_map_id
    when 'guild' then floor(random() * 51)::int + 50
    when 'deeproot' then floor(random() * 41)::int + 40
    else floor(random() * 71)::int + 80
  end;

  update public.characters set
    gold = gold + gold_drop,
    activities_today = activities_today
      || jsonb_build_object('chestCooldowns', cooldowns || jsonb_build_object(chest_key, cooldown_until))
  where id = c.id
  returning * into c;

  return jsonb_build_object('character', public.character_json(c), 'goldDrop', gold_drop, 'cooldownUntil', cooldown_until);
end;
$$;
