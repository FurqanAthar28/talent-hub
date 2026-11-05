# Talent Hub frontend (Next.js 16)

## First-time setup

```bat
npm install
copy .env.example .env.local     &:: then check API_BASE_URL
npm run dev
```

Open http://localhost:3000 (the Django backend must be running on port 8000).
Use "localhost", not "127.0.0.1": login cookies belong to the exact name you
open, so switching between the two makes you look signed out.

## How the frontend talks to Django

```
Browser  ->  /api/backend/...  (app/api/backend/[...path]/route.ts)  ->  Django /api/...
```

The browser never calls Django directly. Because of that, the login cookies
belong to the frontend's own address, and there are no CORS problems.

## Where things live

| What | File |
|---|---|
| Backend (API) addresses | `app/config/apiRoutes.ts` |
| Page addresses | `app/config/routes.ts` |
| Calling the backend (CSRF, auto-refresh of login) | `app/api/client.ts` → `apiFetch()` |
| Editable UI texts | `app/api/ui-content.ts` → `fetchUiContent()` |
| "Sign in first" check before private pages | `proxy.ts` (Next 16's new name for middleware) |

## Checks before you push

```bat
npx tsc --noEmit     &:: type errors
npm run lint         &:: code style problems
npm run build        &:: the real production build
```

## Deploying (for example on Vercel)

Set `API_BASE_URL` to your Django address (https) in the project's
environment variables. Nothing else is needed.
