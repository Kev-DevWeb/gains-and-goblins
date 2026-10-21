-- Gains & Goblins: game tables and server-authoritative game rules.
-- Players can only READ their own character through row-level security;
-- every change goes through the SECURITY DEFINER functions below, which
-- enforce the same rules the old Express server did.

-- ── Tables ──────────────────────────────────────────────────────────────

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  level int not null default 1,
  xp int not null default 0,
  gold int not null default 0,
  moral int not null default 0,
  strength int not null default 5,
  resistance int not null default 5,
  dexterity int not null default 5,
  speed int not null default 5,
  intelligence int not null default 5,
  max_mana int not null default 20,
  willpower int not null default 5,
  charisma int not null default 5,
  -- Unspent branch points plus packed hero-panel data (vitality, spells, accessories)
  branch_points jsonb not null default '{"strength": 0, "dexterity": 0, "intelligence": 0, "willpower": 0}',
  inventory jsonb not null default '[]',
  -- Daily activity flags plus chestCooldowns (chest key -> unlock time in ms)
  activities_today jsonb not null default '{}',
  last_activity_at timestamptz not null default now(),
  last_decay_applied_at timestamptz not null default now(),
  in_recovery boolean not null default false,
  recovery_started_at timestamptz,
  recovery_backup jsonb,
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  type text not null,
  xp_earned int not null,
  logged_at timestamptz not null default now()
);
create index activities_character_logged_at on public.activities (character_id, logged_at);

-- Prices live in the database so clients cannot choose what they pay
create table public.shop_items (
  id text primary key,
  name text not null,
  icon text not null,
  type text not null,
  price int not null check (price > 0)
);
insert into public.shop_items (id, name, icon, type, price) values
  ('potion_hp', 'Agua Mineral', '🥤', 'consumable', 25),
  ('potion_mp', 'Café Cargado', '☕', 'consumable', 25);

-- ── Row-level security ──────────────────────────────────────────────────

alter table public.characters enable row level security;
alter table public.activities enable row level security;
alter table public.shop_items enable row level security;

create policy "Players read their own character" on public.characters
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Players read their own activities" on public.activities
  for select to authenticated using (
    character_id in (select id from public.characters where user_id = (select auth.uid()))
  );

create policy "Anyone reads the shop" on public.shop_items
  for select to anon, authenticated using (true);

-- ── Helpers (internal, not callable by clients) ─────────────────────────

-- Character as the camelCase object the game client already understands
create function public.character_json(c public.characters)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'userId', c.user_id,
    'name', c.name,
    'level', c.level,
    'xp', c.xp,
    'gold', c.gold,
    'moral', c.moral,
    'strength', c.strength,
    'resistance', c.resistance,
    'dexterity', c.dexterity,
    'speed', c.speed,
    'intelligence', c.intelligence,
    'maxMana', c.max_mana,
    'willpower', c.willpower,
    'charisma', c.charisma,
    'branchPoints', c.branch_points,
    'inventory', c.inventory,
    'activitiesToday', c.activities_today,
    'lastActivityAt', c.last_activity_at,
    'lastDecayAppliedAt', c.last_decay_applied_at,
    'inRecovery', c.in_recovery,
    'createdAt', c.created_at
  );
$$;

-- The caller's character, locked for the rest of the transaction
create function public.my_character_for_update()
returns public.characters
language plpgsql
set search_path = ''
as $$
declare
  c public.characters;
begin
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then
    raise exception 'Personaje no encontrado.' using errcode = 'P0002';
  end if;
  return c;
end;
$$;

-- Adds one unit of an item to an inventory array, stacking by id
create function public.inventory_add(inventory jsonb, item jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when exists (select 1 from jsonb_array_elements(inventory) e where e->>'id' = item->>'id') then
      (select jsonb_agg(
         case when e->>'id' = item->>'id'
           then jsonb_set(e, '{count}', to_jsonb((e->>'count')::int + 1))
           else e end)
       from jsonb_array_elements(inventory) e)
    else inventory || jsonb_build_array(item || '{"count": 1}')
  end;
$$;

-- Balanced growth: each level needs level * 50 XP and every stat at 5 + level or more
create function public.compute_level_up(p_level int, p_xp int, p_stats jsonb, out level int, out blocked boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  stat_keys text[] := array['strength', 'resistance', 'dexterity', 'speed', 'intelligence', 'maxMana', 'willpower', 'charisma'];
begin
  level := p_level;
  blocked := false;
  while p_xp >= level * 50 loop
    if exists (
      select 1 from unnest(stat_keys) k
      where not coalesce((p_stats->>k)::int >= 5 + level, false)
    ) then
      blocked := true;
      return;
    end if;
    level := level + 1;
  end loop;
end;
$$;

-- Anti-cheat: per branch, stats + unspent points must add up to the same total as before
create function public.is_valid_stat_allocation(p_old jsonb, p_stats jsonb, p_branch_points jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select bool_and(
    (select sum(coalesce(nullif((p_old->>k)::int, 0), 5)) from unnest(keys) k) + coalesce((p_old->'branchPoints'->>branch)::int, 0)
    = (select sum(coalesce(nullif((p_stats->>k)::int, 0), 5)) from unnest(keys) k) + coalesce((p_branch_points->>branch)::int, 0)
  )
  from (values
    ('strength', array['strength', 'resistance']),
    ('dexterity', array['dexterity', 'speed']),
    ('intelligence', array['intelligence', 'maxMana']),
    ('willpower', array['willpower', 'charisma'])
  ) as b(branch, keys);
$$;

-- Long-inactivity penalty, recovery and weekly decay.
-- Returns true when the weekly decay actually lowered a stat, so the client can tell the player.
create function public.apply_inactivity_rules(p_character_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  c public.characters;
  backup jsonb;
  weekly_decay_applied boolean := false;
  physical_count int;
  recent_count int;
begin
  select * into c from public.characters where id = p_character_id for update;

  -- 1. More than 21 days without activity: back up stats and enter recovery
  if now() - c.last_activity_at > interval '21 days' and not c.in_recovery then
    update public.characters set
      in_recovery = true,
      -- A few seconds back so an activity logged earlier in this request counts toward recovery
      recovery_started_at = now() - interval '5 seconds',
      recovery_backup = jsonb_build_object(
        'level', c.level, 'strength', c.strength, 'resistance', c.resistance,
        'dexterity', c.dexterity, 'speed', c.speed, 'intelligence', c.intelligence,
        'maxMana', c.max_mana, 'willpower', c.willpower, 'charisma', c.charisma),
      -- Physical -30%, willpower/charisma -20%, intelligence/mana -10%; never below 5
      strength = greatest(5, round(c.strength * 0.7)),
      resistance = greatest(5, round(c.resistance * 0.7)),
      dexterity = greatest(5, round(c.dexterity * 0.7)),
      speed = greatest(5, round(c.speed * 0.7)),
      intelligence = greatest(5, round(c.intelligence * 0.9)),
      max_mana = greatest(5, round(c.max_mana * 0.9)),
      willpower = greatest(5, round(c.willpower * 0.8)),
      charisma = greatest(5, round(c.charisma * 0.8)),
      last_activity_at = now()
    where id = c.id
    returning * into c;
  end if;

  -- 2. Recovery ends after 3 physical activities: restore the backed-up stats
  if c.in_recovery then
    select count(*) into physical_count from public.activities
    where character_id = c.id
      and logged_at >= coalesce(c.recovery_started_at, c.last_activity_at)
      and type in ('strength', 'cardio', 'intense', 'running');

    if physical_count >= 3 then
      backup := coalesce(c.recovery_backup, '{}');
      update public.characters set
        in_recovery = false,
        recovery_started_at = null,
        recovery_backup = null,
        level = coalesce((backup->>'level')::int, c.level),
        strength = coalesce((backup->>'strength')::int, c.strength),
        resistance = coalesce((backup->>'resistance')::int, c.resistance),
        dexterity = coalesce((backup->>'dexterity')::int, c.dexterity),
        speed = coalesce((backup->>'speed')::int, c.speed),
        intelligence = coalesce((backup->>'intelligence')::int, c.intelligence),
        max_mana = coalesce((backup->>'maxMana')::int, c.max_mana),
        willpower = coalesce((backup->>'willpower')::int, c.willpower),
        charisma = coalesce((backup->>'charisma')::int, c.charisma)
      where id = c.id
      returning * into c;
    end if;
  end if;

  -- 3. Weekly check: fewer than 3 activities in 7 days lowers every stat by 1 (min 5)
  if now() - c.last_decay_applied_at >= interval '7 days' then
    select count(*) into recent_count from public.activities
    where character_id = c.id and logged_at >= now() - interval '7 days';

    if recent_count < 3 then
      weekly_decay_applied := greatest(c.strength, c.resistance, c.dexterity, c.speed,
        c.intelligence, c.max_mana, c.willpower, c.charisma) > 5;
      update public.characters set
        last_decay_applied_at = now(),
        strength = greatest(5, c.strength - 1),
        resistance = greatest(5, c.resistance - 1),
        dexterity = greatest(5, c.dexterity - 1),
        speed = greatest(5, c.speed - 1),
        intelligence = greatest(5, c.intelligence - 1),
        max_mana = greatest(5, c.max_mana - 1),
        willpower = greatest(5, c.willpower - 1),
        charisma = greatest(5, c.charisma - 1)
      where id = c.id;
    else
      update public.characters set last_decay_applied_at = now() where id = c.id;
    end if;
  end if;

  return weekly_decay_applied;
end;
$$;

-- ── Game API (called from the client with supabase.rpc) ────────────────

-- Returns { character, decayApplied }; character is null until the player creates one
create function public.get_character()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  decay_applied boolean;
begin
  select * into c from public.characters where user_id = auth.uid();
  if not found then
    return jsonb_build_object('character', null, 'decayApplied', false);
  end if;
  decay_applied := public.apply_inactivity_rules(c.id);
  select * into c from public.characters where id = c.id;
  return jsonb_build_object('character', public.character_json(c), 'decayApplied', decay_applied);
end;
$$;

create function public.create_character(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
begin
  insert into public.characters (user_id, name)
  values (auth.uid(), trim(p_name))
  on conflict (user_id) do nothing;
  select * into c from public.characters where user_id = auth.uid();
  return jsonb_build_object('character', public.character_json(c));
end;
$$;

-- Saves progress the client tracks (xp, moral, stat allocation, hero panel data)
-- and applies level-ups. Returns { character, blockedLevelUp, requiredStatValue, decayApplied }.
create function public.sync_character(p_data jsonb)
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
  decay_applied boolean;
  new_xp int;
  growth record;
begin
  c := public.my_character_for_update();

  if v_stats is not null and v_branch_points is not null
     and not public.is_valid_stat_allocation(public.character_json(c), v_stats, v_branch_points) then
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
    branch_points = branch_points || coalesce(v_branch_points, '{}'),
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

-- Returns { character, goldDrop, droppedItem }
create function public.enemy_killed(p_enemy_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  name_lower text := lower(p_enemy_name);
  gold_drop int := floor(random() * 3)::int + 1;
  dropped_item jsonb;
begin
  c := public.my_character_for_update();

  if name_lower like '%boss%' or name_lower like '%reina%' or name_lower like '%rey%' then
    gold_drop := 150;
  end if;

  if random() < 0.6 then
    if name_lower like '%slime%' then
      dropped_item := '{"id": "quest_slime_jelly", "name": "Gelatina de Slime", "icon": "🟢", "type": "quest"}';
    elsif name_lower like '%goblin%' then
      dropped_item := '{"id": "quest_goblin_tooth", "name": "Diente de Goblin", "icon": "🦷", "type": "quest"}';
    end if;
  end if;

  update public.characters set
    gold = gold + gold_drop,
    inventory = case when dropped_item is null then inventory else public.inventory_add(inventory, dropped_item) end
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
create function public.open_chest(p_map_id text, p_x int, p_y int)
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
  gold_drop int;
begin
  c := public.my_character_for_update();

  if now_ms < coalesce((c.activities_today->'chestCooldowns'->>chest_key)::bigint, 0) then
    raise exception 'El cofre está en cooldown.' using errcode = 'P0001';
  end if;

  gold_drop := case p_map_id
    when 'guild' then floor(random() * 51)::int + 50
    when 'deeproot' then floor(random() * 41)::int + 40
    when 'cueva_goblin' then floor(random() * 71)::int + 80
    else 20
  end;

  update public.characters set
    gold = gold + gold_drop,
    activities_today = jsonb_set(
      activities_today || jsonb_build_object('chestCooldowns', coalesce(activities_today->'chestCooldowns', '{}')),
      array['chestCooldowns', chest_key], to_jsonb(cooldown_until))
  where id = c.id
  returning * into c;

  return jsonb_build_object('character', public.character_json(c), 'goldDrop', gold_drop, 'cooldownUntil', cooldown_until);
end;
$$;

-- Returns the updated character
create function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  item public.shop_items;
begin
  select * into item from public.shop_items where id = p_item_id;
  if not found then
    raise exception 'Producto no disponible.' using errcode = 'P0001';
  end if;

  c := public.my_character_for_update();
  if c.gold < item.price then
    raise exception 'Oro insuficiente.' using errcode = 'P0001';
  end if;

  update public.characters set
    gold = gold - item.price,
    inventory = public.inventory_add(inventory,
      jsonb_build_object('id', item.id, 'name', item.name, 'icon', item.icon, 'type', item.type))
  where id = c.id
  returning * into c;

  return public.character_json(c);
end;
$$;

-- Returns the updated character
create function public.consume_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
begin
  c := public.my_character_for_update();
  if not exists (
    select 1 from jsonb_array_elements(c.inventory) e
    where e->>'id' = p_item_id and (e->>'count')::int > 0
  ) then
    raise exception 'No posees este item.' using errcode = 'P0001';
  end if;

  update public.characters set
    inventory = coalesce((
      select jsonb_agg(item order by ord)
      from (
        select case when e->>'id' = p_item_id
                 then jsonb_set(e, '{count}', to_jsonb((e->>'count')::int - 1))
                 else e end as item, ord
        from jsonb_array_elements(c.inventory) with ordinality as t(e, ord)
      ) s
      where (item->>'count')::int > 0
    ), '[]')
  where id = c.id
  returning * into c;

  return public.character_json(c);
end;
$$;

-- ── Permissions ─────────────────────────────────────────────────────────
-- Supabase grants EXECUTE on new functions to everyone by default; only the
-- game API is callable, and only by signed-in players.

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.get_character(),
  public.create_character(text),
  public.sync_character(jsonb),
  public.enemy_killed(text),
  public.open_chest(text, int, int),
  public.buy_item(text),
  public.consume_item(text)
to authenticated;
