# Gaao

Sing-along web app: shows the playing song's lyrics in English letters (romanized), with a one-line English meaning under each line, synced to the music. Built for Punjabi, Haryanvi, Hindi/Urdu and Spanish songs. Full background and roadmap: @HANDOFF.md

## Layout
- `index.html`: the whole front end (vanilla JS, no build step). Served by GitHub Pages at https://fambus.github.io/gaao/
- `supabase/functions/gaao/index.ts`: Deno edge function. Routes `/health`, `/recognize` (AudD), `/meanings` (Claude). Project ref `oqznbxiibpiocvwoqexj` (ap-south-1).
- `supabase/migrations/`: tables `songs` (shared meanings cache), `invites`, `usage`, and function `gaao_bump`.

## Rules
- The repo is public. Never commit API keys, invite codes or `.env` files. Server secrets live in Supabase function secrets (`AUDD_API_TOKEN`, `ANTHROPIC_API_KEY`, optional `GAAO_MODEL`).
- The primary device is an iPhone 14 in Safari (added to the Home Screen). Test every UI change at 390x844 and keep tap targets large. The mic needs HTTPS and a user gesture; iOS records `audio/mp4`.
- Never cache a failed or empty meanings result. Bump the cache key version (`v3:song:` in the front end, `PROMPT_VERSION` in the backend) when the output format changes.
- Prefer free, no-key paths first, then the paid backend: lyrics from LRCLIB, local romanizer, then Claude via the backend, with free translators as a fallback.
- Don't scrape lyrics or annotation sites (Genius etc.). Use official APIs only.

## Verify before saying done
- `node --check` on the extracted `<script>` (or a lint/test script once one exists).
- Playwright run at iPhone size with a fake mic (`--use-fake-device-for-media-stream`) and a mocked backend; screenshot the result and look at it.
- Backend: `supabase functions serve gaao` locally, then `curl /health`. Deploy with `supabase functions deploy gaao --no-verify-jwt`.
