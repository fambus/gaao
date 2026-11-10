# Gaao

Sing-along web app: shows the playing song's lyrics in English letters (romanized), with a one-line English meaning under each line, synced to the music. Built for Punjabi, Haryanvi, Hindi/Urdu and Spanish songs. Full background and roadmap: @HANDOFF.md

## Layout
- `index.html` + `src/`: the front end. Vanilla JS ES modules, built with Vite (`base: /gaao/`), deployed to GitHub Pages at https://fambus.github.io/gaao/ by `.github/workflows/deploy.yml` on every push to `main`.
  - `src/main.js` boots; `src/state.js` holds `LS` (storage), `S` (playback), `B` (backend status); `src/track.js` loads a song.
  - `src/roman/` romanization, `src/lyrics/` LRCLIB, `src/meanings/` Claude and free translators, `src/sources/` Spotify and Listen, `src/ui/` screens.
- `tests/`: `*.test.js` are Vitest unit tests; `tests/e2e/*.spec.js` are Playwright tests with all network mocked in `tests/e2e/fixtures.js`.
- `PLAN.md`: the approved phase plan. Check it before starting a phase.
- `supabase/functions/gaao/index.ts`: Deno edge function. Routes `/health`, `/recognize` (AudD), `/meanings` (Claude). Project ref `oqznbxiibpiocvwoqexj` (ap-south-1).
- `supabase/migrations/`: tables `songs` (shared meanings cache), `invites`, `usage`, and function `gaao_bump`.

## Rules
- The repo is public. Never commit API keys, invite codes or `.env` files. Server secrets live in Supabase function secrets (`AUDD_API_TOKEN`, `ANTHROPIC_API_KEY`, optional `GAAO_MODEL`).
- The primary device is an iPhone 14 in Safari (added to the Home Screen). Test every UI change at 390x844 and keep tap targets large. The mic needs HTTPS and a user gesture; iOS records `audio/mp4`.
- Never cache a failed or empty meanings result. Bump the cache key version (`v3:song:` in the front end, `PROMPT_VERSION` in the backend) when the output format changes.
- Prefer free, no-key paths first, then the paid backend: lyrics from LRCLIB, local romanizer, then Claude via the backend, with free translators as a fallback.
- Don't scrape lyrics or annotation sites (Genius etc.). Use official APIs only.

## Verify before saying done
- `npm run check:secrets`, `npm test` (Vitest) and `npm run build`.
- `npm run test:e2e`: Playwright at iPhone 390x844 and desktop 1440x900 with a fake mic and a mocked backend. Screenshots go to `test-results/shots/`; look at them.
- Backend: `npx supabase functions serve gaao` locally, then `curl /health`. Deploy with `npx supabase functions deploy gaao --no-verify-jwt`.
- This PC has Node 20.11, so Vite stays on v6 and Vitest on v3 (newer majors need Node 20.19+). CI uses Node 22.
- Commits use the GitHub noreply address (set in the repo's local git config), so no personal email lands in the public history.
