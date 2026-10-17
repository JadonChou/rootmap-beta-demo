# rootmap-beta-demo

Disposable fullstack app for ROOTMAP private-beta AI tests.

- Frontend: Next.js App Router (`/`, `/login`, `/dashboard`)
- Backend API: `/api/auth/*`, `/api/me`, `/api/users`
- Data: in-memory users in `lib/db.ts` (stand-in for a test database)
- Auth: cookie session; `admin@demo.local` is admin, `bob@demo.local` is user

Do not use for production.
