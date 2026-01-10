# My Task App

A small React + Firebase task tracker with offline-first behavior and automatic sync.

## Features
- Add / complete / delete tasks
- Offline support: Firestore IndexedDB persistence + `localStorage` fallback
- Automatic sync of local-only tasks when the app regains connectivity
- Mobile-first UI with Tailwind CSS and a Dark Mode toggle

## How data syncs to Firebase

1. Initialization
   - The app initializes Firebase using configuration read from Vite env variables (`import.meta.env.VITE_FIREBASE_*`).
   - Firestore offline persistence is enabled via `enableIndexedDbPersistence(db)` so the Firestore SDK caches data in IndexedDB.

2. Reading data
   - The app uses `onSnapshot(query(collection(db, 'tasks')))` to listen to live updates from Firestore and show the authoritative server state in the UI.

3. Local fallback and optimistic writes
   - When an add or update to Firestore fails (e.g. offline), the app creates a local-only task with an id prefixed by `local-` and stores tasks in `localStorage` so the UI remains responsive and data isn't lost on refresh.
   - Local-only tasks are shown with a small `(local)` label so you can tell they haven't been synced yet.

4. Sync on reconnect
   - When the app detects the network is back online, it attempts to push all local-only tasks to Firestore (`addDoc`) and, upon success, removes the local copies. Any failed sync attempts remain local and will be retried later.

5. Delete behavior
   - Deleting a local-only task removes it locally.
   - Deleting a synced task removes it from Firestore via `deleteDoc`. The UI performs optimistic removal and restores the task if the delete fails.

## Required environment variables

Set these for both local development and in your hosting environment (Netlify, Vercel, etc.):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Local: copy `my-task-app/.env.example` to `my-task-app/.env` and fill values.

Netlify: add these as Environment Variables in Site settings → Build & deploy → Environment variables. Alternatively use the provided script `scripts/push-env-to-netlify.sh` with the Netlify CLI:

```bash
# login first: netlify login
NETLIFY_SITE_ID=your_site_id ./scripts/push-env-to-netlify.sh
```

## Deploying

- The repo contains `netlify.toml` configured to build the `my-task-app` subfolder and publish `my-task-app/dist`.
- Netlify build command: it runs `cd my-task-app && npm install && npm run build` (so dependencies like `vite` are available).

Manual local build:

```bash
cd my-task-app
npm install
npm run build
```

Then serve or deploy the contents of `my-task-app/dist`.

## Testing sync (recommended workflow)

1. On Desktop: run `npm run dev` in `my-task-app`, or open deployed site on desktop.
2. Add a few tasks and confirm they appear in Firestore (Firebase Console → Firestore → tasks).
3. On your phone: open the deployed site URL (or scan QR from the dev server if you expose host) and verify the same tasks appear.
4. Test offline behavior:
   - Turn off network on one device (e.g., phone), add tasks — they should appear locally and be labeled `(local)`.
   - Re-enable network; the app should automatically attempt to sync and those tasks should appear in Firestore and on the other device.

## Troubleshooting

- 404 / Page not found on Netlify
  - Ensure `_redirects` is present in `my-task-app/public/_redirects` (it is) and Netlify's publish directory is set to `my-task-app/dist`. `netlify.toml` in the repo sets this automatically.

- `vite: not found` during Netlify build
  - `netlify.toml` now runs `npm install` inside `my-task-app` before `npm run build` so `vite` is available as a devDependency. Make sure the repository has been pushed and redeploy.

- Deployed site data differs from local
  - This is usually caused by missing environment variables on the host: set all `VITE_FIREBASE_*` variables in the hosting environment so the deployed build points to the same Firebase project.

## Options / next steps

- Add a confirmation modal for deletes.
- Add toasts for sync success / failure.
- Add automatic conflict resolution if a task is edited in parallel on multiple devices.

If you want, I can add a short console debug log of the active `projectId` during Firebase init to help confirm deployments use the correct project; or I can add a confirmation dialog for deletes now.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
