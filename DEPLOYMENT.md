# Deployment Guide

This project is designed as a split deployment:

- Frontend: Vercel
- Backend: Railway or another always-on Node host
- Database: Neon PostgreSQL

## Railway backend setup

Because the backend lives in the `server/` folder, Railway must deploy that subproject instead of the repository root.

1. Open your Railway service settings.
2. Click `Add Root Directory` and select `server`.
3. In `Variables`, add `DATABASE_URL` and `FRONTEND_URL`.
4. Make sure the start command is `npm start`.
5. Deploy the service.

If Railway asks for a build command, use `npm install` or leave it empty if the service runs `npm start` directly.

## Environment variables

Frontend on Vercel:

- `VITE_API_URL` = public backend URL, for example `https://your-backend-domain.example/api`

Backend on Railway/Render/VPS:

- `PORT` = hosting platform port or `3001`
- `FRONTEND_URL` = your public Vercel URL, for example `https://your-project.vercel.app`
- `DATABASE_URL` = Neon connection string

## Recommended flow for testers

1. Deploy the backend first.
2. Copy its public URL into `VITE_API_URL` on Vercel.
3. Copy the Vercel URL into `FRONTEND_URL` on the backend host.
4. Redeploy both services.

## Quick check

- Backend health: `GET /api/health`
- Auth endpoints: `POST /api/auth/register` and `POST /api/auth/login`

If the frontend still tries to call `localhost`, the Vercel environment variable is missing or not set in the production deployment.