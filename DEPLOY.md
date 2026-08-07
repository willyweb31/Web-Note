# Semester Focus

This bundle is ready for Vercel as a Vite project.

If Vercel asks for settings, use:

- Framework preset: Vite
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: `dist`

Task data is cached locally and syncs to Supabase after sign-in.

The workspace explicitly permits esbuild's required installation script so
pnpm's strict build-script policy works in Vercel's CI environment.

## Supabase

The app expects these Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The SQL schema and row-level security policies are included under
`supabase/migrations`. After deploying, sign in from the app with an email link.
Existing browser tasks are imported automatically when the cloud account is
empty.

Run both SQL files in `supabase/migrations` in filename order. The second
migration adds user-created classes, color labels, and task assignments.
