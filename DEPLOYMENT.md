# Deployment Guide

The game is a static site on Vercel that talks straight to Supabase:

- Frontend: Vercel
- Accounts, database and game rules: Supabase (Auth, Postgres and RPC functions)
- Lobby and invites: Supabase Realtime; the game itself runs peer to peer through PeerJS

The `server/` folder is the old Express backend for Railway. The game no longer uses it.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In `SQL Editor`, run every file in `supabase/migrations/` in name order. Each one is safe to run again.
3. In `Authentication → URL Configuration`, set `Site URL` to your Vercel URL and add it to `Redirect URLs` with `/**` at the end (for example `https://your-project.vercel.app/**`). Add the preview URLs you use too.
4. For Google login: create an OAuth client in Google Cloud and paste its client id and secret in `Authentication → Providers → Google`. The secret goes only there, never in the frontend.

Free projects pause after a week without activity. Restore them from the project overview.

## Environment variables

Frontend on Vercel (type `Config`, for Production and Preview):

- `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the project's anon (public) key from `Project Settings → API`

Vite bakes these into the build, so redeploy after changing them. Never put the `service_role` key in the frontend.

## Quick check

- The login screen shows the Google button and no configuration error.
- Registering creates a row in the `characters` table.
- Logging an activity in game adds a row to `activities`.

If the page says Supabase is not configured, one of the two variables is missing from that deployment.

## Testing the game rules

`supabase/tests/game_rules.test.sql` checks the rules against a throwaway local Postgres. The commands are at the top of the file.
