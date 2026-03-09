# Repository Guidelines

## Project Structure & Module Organization
Repo is a pnpm workspace. `apps/web/` hosts the Next.js 16 dashboard (App Router in `src/app`, UI in `src/components`, telemetry providers/hooks under `src/providers` and `src/hooks`, assets in `public/`). `packages/bridge/` handles the UDP→Supabase relay, `packages/shared/` exports packet types and channel helpers, `dcs/` ships the Lua exporter, and `supabase/migrations/` tracks SQL schema. Planning and QA docs such as `PRD.md` plus `JARVIS_DCS_Prototype_Test_Plan.md` live at the repo root.

## Build, Test, and Development Commands
Key commands: `pnpm dev:web` (Next dev server on :3000), `pnpm dev:bridge [-- --channel session:dev]` (tsx watcher for the relay), `pnpm build` (workspace build before release), `pnpm typecheck` (shared TS contracts), `pnpm --filter @jarvis-dcs/web lint` (core-web-vitals), and the pairing `pnpm smoke:web` + `pnpm smoke:bridge` for Supabase end-to-end validation.

## Coding Style & Naming Conventions
Target Node ≥22 with strict TS (`tsconfig.base.json`). React modules are functional, declare `use client` explicitly, and follow PascalCase filenames; hooks start with `use`. Favor two-space indentation, omit semicolons, and order imports React → libs → local `@/...` or `@jarvis-dcs/shared`. Styling should stay within Tailwind v4 utilities and the `jarvis-*` tokens defined in `apps/web/src/app/globals.css`. Bridge code remains pure ESM; run ESLint before pushing.

## Testing Guidelines
Automated tests are minimal, so follow `JARVIS_DCS_Prototype_Test_Plan.md`. Execute the smoke pair (`pnpm smoke:bridge` + `pnpm smoke:web`) whenever you touch packets, Supabase, or connection states, and state which D1–D6 cases you covered. Capture packet-rate samples or HUD screenshots for PRs, and log bridge throttle/retry metrics so reviewers can validate without launching DCS.

## Commit & Pull Request Guidelines
History uses Conventional Commits with scopes such as `fix(v2.0)` or `feat(bridge)`. Keep subjects ≤72 characters, imperative, and squash fixups locally. PRs should explain motivation, outline implementation tradeoffs, link tickets, and list the commands/tests you ran. UI work requires screenshots or clips; bridge/DCS updates need trimmed logs that show telemetry flow and reconnect attempts.

## Security & Configuration Tips
Never commit `.env.local`, `packages/bridge/.env`, or Supabase keys. Clone env files from `.env.example`, keep service-role credentials only on the bridge host, and expose only `NEXT_PUBLIC_*` anon keys to the web app. Update the Lua exporter by running `dcs/install.bat` so `Export.lua` chaining stays intact, and redact call signs, coordinates, and session codes before sharing logs or screenshots.
