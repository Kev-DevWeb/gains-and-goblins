-- Game rules and security tests for the Supabase migration.
-- Run against a throwaway local Postgres (not your Supabase project):
--   createdb game
--   psql -d game -f supabase/tests/supabase_stub.sql
--   for f in supabase/migrations/*.sql; do psql -d game -v ON_ERROR_STOP=1 -f "$f"; done
--   psql -d game -q -t -A -f supabase/tests/game_rules.test.sql | grep -E "^(OK|FALLA)|pruebas OK"
-- Note: wrap calls in a subquery before using BETWEEN, which evaluates its left side twice.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create schema t;
grant usage on schema t to anon, authenticated;
create table t.results (n serial, name text, ok boolean, detail text);
grant all on t.results to anon, authenticated; grant all on sequence t.results_n_seq to anon, authenticated;
create function t.check(name text, ok boolean, detail text default '') returns void language sql as
  $$ insert into t.results (name, ok, detail) values (name, coalesce(ok, false), detail) $$;
-- Runs a statement as the current role and returns the error message (null if it succeeded)
create function t.err(stmt text) returns text language plpgsql as
  $$ begin execute stmt; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema t to anon, authenticated;
create function t.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, false) $$;
grant execute on function t.as_user(text) to anon, authenticated;

insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'ana@x.com'), ('22222222-2222-2222-2222-222222222222', 'beto@x.com');
\set A '\'11111111-1111-1111-1111-111111111111\''
\set B '\'22222222-2222-2222-2222-222222222222\''

-- ── Anonymous visitors ─────────────────────────────────────────────
set role anon;
select t.check('anon no puede llamar get_character', t.err('select public.get_character()') like '%permission denied%');
select t.check('anon puede ver la tienda', (select count(*) from public.shop_items) = 2);
reset role;

-- ── Account creation ───────────────────────────────────────────────
set role authenticated;
select t.as_user(:A);
select t.check('sin personaje devuelve null', public.get_character()->'character' = 'null'::jsonb);
select t.check('crear personaje', public.create_character('  Ana  ')->'character'->>'name' = 'Ana');
select t.check('crear dos veces no duplica', (public.create_character('Otra')->'character'->>'name') = 'Ana');
select t.check('nombre vacio rechazado', t.err($$select public.create_character('   ')$$) is not null);
select t.as_user(:B);
select public.create_character('Beto');
reset role;
-- Beto: give him gold to steal
update public.characters set gold = 500 where user_id = :B;

-- ── Isolation between players ─────────────────────────────────────
set role authenticated;
select t.as_user(:A);
select t.check('solo veo mi personaje', (select count(*) from public.characters) = 1 and (select name from public.characters) = 'Ana');
select t.check('no puedo editar tablas directamente', t.err($$update public.characters set gold = 99999$$) is null
  and (select gold from public.characters) = 0);
select t.check('no puedo cambiar precios', t.err($$update public.shop_items set price = 0$$) is null
  and (select min(price) from public.shop_items) = 25);
select t.check('no puedo insertar personajes ajenos', t.err($$insert into public.characters (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'X')$$) is not null);
select t.check('no puedo llamar funciones internas', t.err($$select public.apply_inactivity_rules(gen_random_uuid())$$) like '%permission denied%');
select t.check('no puedo leer actividades ajenas', (select count(*) from public.activities) = 0);
reset role;
select t.check('el oro de Beto sigue intacto', (select gold from public.characters where user_id = :B) = 500);

-- ── sync_character ────────────────────────────────────────────────
set role authenticated; select t.as_user(:A);
reset role; update public.characters set branch_points = '{"strength":1,"dexterity":0,"intelligence":0,"willpower":0,"vitality":100,"spells":["shield"]}' where user_id = :A; set role authenticated;
select t.check('asignacion valida', (public.sync_character('{"stats":{"strength":6,"resistance":5,"dexterity":5,"speed":5,"intelligence":5,"maxMana":20,"willpower":5,"charisma":5},"branchPoints":{"strength":0,"dexterity":0,"intelligence":0,"willpower":0}}')->'character'->>'strength')::int = 6);
select t.check('branchPoints conserva datos extra', (select branch_points->'spells' from public.characters) = '["shield"]');
select t.check('trampa en puntos rechazada', t.err($$select public.sync_character('{"stats":{"strength":9,"resistance":5,"dexterity":5,"speed":5,"intelligence":5,"maxMana":20,"willpower":5,"charisma":5},"branchPoints":{"strength":0}}')$$) like '%inválida%');
reset role; update public.characters set strength=8,resistance=8,dexterity=8,speed=8,intelligence=8,max_mana=8,willpower=8,charisma=8,level=1 where user_id = :A; set role authenticated;
select t.check('sube 2 niveles (1 -> 4 con 160 xp)', (public.sync_character('{"xp":160}')->'character'->>'level')::int = 4);
reset role; update public.characters set charisma=6, level=1, xp=0 where user_id = :A; set role authenticated;
select t.check('nivel bloqueado por stat bajo', (select (r->>'blockedLevelUp')::boolean and (r->'character'->>'level')::int = 2 and (r->>'requiredStatValue')::int = 7
  from (select public.sync_character('{"xp":160}') r) s));
reset role; update public.characters set level=1, xp=0 where user_id = :A; set role authenticated;
select t.check('49 xp no sube', (public.sync_character('{"xp":49}')->'character'->>'level')::int = 1);
reset role; update public.characters set activities_today = '{"chestCooldowns":{"guild_1_1":123}}' where user_id = :A; set role authenticated;
select public.sync_character('{"moral":3,"newActivityLogged":{"type":"strength"},"activitiesToday":{"bar":2,"chestCooldowns":{}}}');
select t.check('actividad registrada', (select count(*) from public.activities) = 1);
select t.check('moral guardada', (select moral from public.characters) = 3);
select t.check('cooldowns de cofres no se pueden borrar', (select activities_today from public.characters) = '{"bar":2,"chestCooldowns":{"guild_1_1":123}}');
reset role;

-- ── Activities grant a branch point ───────────────────────────────
reset role; update public.characters set strength=5,resistance=5,dexterity=5,speed=5,intelligence=5,max_mana=20,willpower=5,charisma=5,
  branch_points = '{"strength":0,"dexterity":0,"intelligence":0,"willpower":0}' where user_id = :A; set role authenticated;
select t.check('actividad con su punto de regalo se acepta', (public.sync_character('{"xp":50,"stats":{"strength":5,"resistance":5,"dexterity":5,"speed":5,"intelligence":5,"maxMana":20,"willpower":5,"charisma":5},"branchPoints":{"strength":1,"dexterity":0,"intelligence":0,"willpower":0},"newActivityLogged":{"type":"strength","xpEarned":50}}')->'character'->'branchPoints'->>'strength')::int = 1);
select t.check('dos puntos con una actividad es trampa', t.err($$select public.sync_character('{"stats":{"strength":5,"resistance":5,"dexterity":5,"speed":5,"intelligence":5,"maxMana":20,"willpower":5,"charisma":5},"branchPoints":{"strength":3,"dexterity":0,"intelligence":0,"willpower":0},"newActivityLogged":{"type":"strength"}}')$$) like '%inválida%');
select t.check('el punto va a la rama de la actividad', t.err($$select public.sync_character('{"stats":{"strength":5,"resistance":5,"dexterity":5,"speed":5,"intelligence":5,"maxMana":20,"willpower":5,"charisma":5},"branchPoints":{"strength":2,"dexterity":0,"intelligence":0,"willpower":0},"newActivityLogged":{"type":"study"}}')$$) like '%inválida%');
select t.check('actividad inventada', t.err($$select public.sync_character('{"newActivityLogged":{"type":"dormir"}}')$$) like '%desconocida%');
select t.check('sin puntos enviados el servidor suma el punto', (public.sync_character('{"newActivityLogged":{"type":"meditation"}}')->'character'->'branchPoints'->>'willpower')::int = 1);
reset role;

-- ── Weekly decay ──────────────────────────────────────────────────
delete from public.activities;
update public.characters set strength=9,resistance=9,dexterity=9,speed=9,intelligence=9,max_mana=9,willpower=9,charisma=9,
  last_decay_applied_at = now() - interval '8 days', last_activity_at = now() - interval '1 day' where user_id = :A;
set role authenticated; select t.as_user(:A);
select t.check('decay semanal avisa', (public.get_character()->>'decayApplied')::boolean);
select t.check('decay baja 1 punto', (select strength from public.characters) = 8);
select t.check('decay no se repite el mismo dia', not (public.get_character()->>'decayApplied')::boolean);
reset role;
insert into public.activities (character_id, type, xp_earned) select id, 'cardio', 50 from public.characters, generate_series(1,3) where user_id = :A;
update public.characters set last_decay_applied_at = now() - interval '8 days' where user_id = :A;
set role authenticated; select t.as_user(:A);
select t.check('con 3 actividades no hay decay', not (public.get_character()->>'decayApplied')::boolean and (select strength from public.characters) = 8);
reset role;
delete from public.activities;
update public.characters set strength=5,resistance=5,dexterity=5,speed=5,intelligence=5,max_mana=5,willpower=5,charisma=5, last_decay_applied_at = now() - interval '8 days' where user_id = :A;
set role authenticated; select t.as_user(:A);
select t.check('stats en minimo: no avisa', not (public.get_character()->>'decayApplied')::boolean);
reset role;

-- ── Long inactivity and recovery ──────────────────────────────────
update public.characters set strength=20,resistance=20,dexterity=20,speed=20,intelligence=20,max_mana=20,willpower=20,charisma=20, level=5,
  last_activity_at = now() - interval '22 days', last_decay_applied_at = now() where user_id = :A;
set role authenticated; select t.as_user(:A);
select public.get_character();
select t.check('inactividad: entra en recuperacion', (select in_recovery and strength = 14 and intelligence = 18 and willpower = 16 and level = 5 from public.characters));
select public.sync_character('{"newActivityLogged":{"type":"strength"}}');
select public.sync_character('{"newActivityLogged":{"type":"study"}}');
select public.sync_character('{"newActivityLogged":{"type":"running"}}');
select t.check('2 fisicas: sigue en recuperacion', (select in_recovery from public.characters));
select public.sync_character('{"newActivityLogged":{"type":"cardio"}}');
select t.check('3 fisicas: recupera stats', (select not in_recovery and strength = 20 and intelligence = 20 from public.characters));

-- ── Enemies ───────────────────────────────────────────────────────
reset role; update public.characters set gold = 0, inventory = '[]' where user_id = :A; set role authenticated;
select t.check('slime da 1-3 de oro', (select bool_and(g between 1 and 3) from (select (public.enemy_killed('Slime')->>'goldDrop')::int g from generate_series(1, 30) offset 0) s));
select t.check('gelatina se apila', (select (inventory->0->>'id') = 'quest_slime_jelly' and jsonb_array_length(inventory) = 1 and (inventory->0->>'count')::int between 5 and 30 from public.characters));
select t.check('Rey Goblin da 150', (public.enemy_killed('Rey Goblin')->>'goldDrop')::int = 150);
select t.check('oro acumulado coincide', (select gold between 180 and 240 from public.characters));

-- ── Chests ────────────────────────────────────────────────────────
select t.check('cofre de cueva da 80-150', (select g between 80 and 150 from (select (public.open_chest('cueva_goblin', 3, 4)->>'goldDrop')::int g offset 0) s));
select t.check('mismo cofre en cooldown', t.err($$select public.open_chest('cueva_goblin', 3, 4)$$) like '%cooldown%');
select t.check('otro cofre si se abre', (select g between 80 and 150 from (select (public.open_chest('cueva_goblin', 9, 9)->>'goldDrop')::int g offset 0) s));

-- ── Shop and items ────────────────────────────────────────────────
reset role; update public.characters set gold = 30, inventory = '[]' where user_id = :A; set role authenticated;
select t.check('comprar agua cuesta 25', (public.buy_item('potion_hp')->>'gold')::int = 5);
select t.check('sin oro suficiente', t.err($$select public.buy_item('potion_mp')$$) like '%insuficiente%');
select t.check('producto inventado', t.err($$select public.buy_item('espada_legendaria')$$) like '%no disponible%');
reset role; update public.characters set gold = 100 where user_id = :A; set role authenticated;
select public.buy_item('potion_hp');
select t.check('dos aguas apiladas', (select (inventory->0->>'count')::int = 2 from public.characters));
select t.check('consumir resta 1', (public.consume_item('potion_hp')->'inventory'->0->>'count')::int = 1);
select t.check('consumir el ultimo lo quita', jsonb_array_length(public.consume_item('potion_hp')->'inventory') = 0);
select t.check('consumir sin tener', t.err($$select public.consume_item('potion_hp')$$) like '%No posees%');
reset role;

-- ── Finding players for invites ───────────────────────────────────
set role authenticated; select t.as_user(:A);
select t.check('encuentra a Beto por correo', public.find_player_by_email('  BETO@x.com ') = '22222222-2222-2222-2222-222222222222');
select t.check('no se encuentra a si mismo', public.find_player_by_email('ana@x.com') is null);
select t.check('correo desconocido', public.find_player_by_email('nadie@x.com') is null);
reset role;
set role anon;
select t.check('anon no puede buscar jugadores', t.err($$select public.find_player_by_email('beto@x.com')$$) like '%permission denied%');
reset role;

select case when ok then 'OK   ' else 'FALLA' end || ' ' || name || coalesce(' ' || nullif(detail, ''), '') from t.results order by n;
select count(*) filter (where ok) || ' de ' || count(*) || ' pruebas OK' from t.results;
