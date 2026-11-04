-- Party invites are sent by email, but emails are never broadcast to other players:
-- the inviter's client resolves the email to a player id with this function.
create function public.find_player_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  join public.characters c on c.user_id = u.id
  where lower(u.email) = lower(trim(p_email))
    and u.id <> auth.uid();
$$;

revoke execute on function public.find_player_by_email(text) from public, anon, authenticated;
grant execute on function public.find_player_by_email(text) to authenticated;
