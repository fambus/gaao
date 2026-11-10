# Gaao handoff (10 Nov 2026)

## What exists and works
- **Follow Spotify:** PKCE login with no server; each user enters their own Spotify app Client ID (Settings → "Use your own Spotify app"). The app polls currently-playing every 2.5 s and interpolates progress with `performance.now()`. It shows lines 250 ms early (`LEAD_MS`) and has a user offset. It also prefetches meanings for queued tracks.
- **Lyrics:** LRCLIB (`/api/get`, then `/api/search` with cleaned titles and a duration tolerance). It prefers synced LRC.
- **Romanization:** an offline romanizer for **Gurmukhi and Devanagari only** (`romanize()` / `romanWord()` around line 700 of `index.html`). It handles schwa deletion, nasals, gemination and y-glides.
- **Meanings:** `getAI()` calls the backend `/meanings`, which runs Claude with a forced `song_explained` tool returning `{language, summary, lines:[{i,r,m}]}`. Results are cached per song in `public.songs` and shared by everyone. Without a backend it uses a personal Anthropic key from the browser. Free translators (Google gtx, Google alt, MyMemory) fill in after 3.5 s if Claude is slow or off.
- **Listen (Shazam-like):** records 8 s with MediaRecorder (`audio/mp4` on iOS, WAV fallback) and posts it to `/recognize`, which proxies AudD with `return=spotify,apple_music`. The app syncs using AudD's `timecode` plus the time elapsed, and re-listens automatically when the song should have ended. Tested only in headless Chromium with a fake mic; **never confirmed on a real iPhone**.
- **Sharing:** links of the form `https://fambus.github.io/gaao/?invite=<code>` (`&cid=<spotify client id>` is optional). Every backend call sends the `x-gaao-invite` header. Daily caps come from `invites.recognize_per_day` and `invites.songs_per_day` via `gaao_bump()`.
- **UI:** dark, single screen, a welcome sheet ("Listen nearby" / "Follow my Spotify"), and a settings sheet with status, Share, Test connections, Test microphone, toggles (wake lock, original script) and clear cache.

## Live state and blockers (updated 10 Nov 2026, during Phase A of PLAN.md)
1. The Supabase project `gaao` is **active** again. `.github/workflows/keepalive.yml` pings `/health?db=1` twice a week so it doesn't pause.
2. **No server secrets are set**, so `/health` returns `listen:false, meanings:false`. Add `AUDD_API_TOKEN` (from dashboard.audd.io: 300 free requests, then about $5 per 1,000) and `ANTHROPIC_API_KEY` in the Supabase dashboard under Edge Functions → Secrets. Set `GAAO_MODEL=claude-haiku-5-5` (about 0.2¢ per new song, versus about 3¢ on Sonnet 5.5).
3. The repo is now a Vite project. GitHub Pages is built by `.github/workflows/deploy.yml`, not served from the repo root.
4. The `pg_net` extension is unused (checked: no functions, triggers or queued requests). `supabase/migrations/20261110000001_drop_pg_net.sql` drops it; it still has to be applied to the live database.
5. **The `invites` table is empty.** The owner's invite code has to be re-created in the dashboard's SQL editor (template in README.md). Invite codes never go in this repo.
6. The live database's migration history uses different timestamps (`20261018143458`, `20261018144131`) from the two older files in `supabase/migrations/`. Line them up before the first `supabase db push`.

## Bug: lyrics not shown in English letters (see docs/bug-urdu-not-romanized.png)
"Hum Dekhenge" (Iqbal Bano) comes from LRCLIB in **Urdu (Perso-Arabic) script**. `romanize()` only knows Gurmukhi and Devanagari, so it returns the line unchanged. Meanings still arrive because the translators accept any script. Likely fixes, best first:
- Have Claude return `r` (the romanization) for every script. This already happens when the backend is on; make sure the UI swaps in `r` as soon as it arrives, even when the line was never romanized locally.
- Free fallback: Google's `translate_a/single` with `dt=rm` usually returns a source transliteration for Urdu, Arabic, Hindi and others (verify this live first). Use it for any script the local romanizer doesn't handle (Urdu, Arabic, Cyrillic, Korean, Japanese and so on).
- Optionally look for an alternative LRCLIB record of the same song in Latin or Devanagari script before falling back.
- Never show raw non-Latin text as the main line unless "Show original script" is on.

## Goals for this phase (from the owner)
1. **Finish it as a proper project on GitHub:** clean repo, README, migrations and function in `supabase/`, deploys that can be repeated, and no secrets in git.
2. **Usable on any device:** an installable PWA (manifest, icons, service worker for the app shell) for phones; a desktop floating window (see FloatLyrics below); and keyboard shortcuts on desktop.
3. **Integrate FloatLyrics:** The owner already uses it and will provide its folder. Read its code first and decide whether Gaao should feed it (Gaao as a lyrics and meanings provider) or borrow its floating always-on-top window. One no-install option for desktop is the browser's Document Picture-in-Picture API (Chrome and Edge), which gives an always-on-top mini window from a normal web page.
4. **Better contextual meanings:** Claude stays the main engine. Improve the prompt to cover slang, idioms, cultural and poetic references, and a per-song summary, and expose the summary in the UI. Genius: use only the official API (search, plus song/referent metadata where licensing allows) as optional context for Claude. **Do not scrape genius.com** (against its terms).
5. **Polish:** smooth line transitions, better match rate, offline cache, empty and error states, and onboarding a friend can finish in under 30 seconds.

## Constraints and known limits
- Spotify dev-mode apps allow 5 users and the owner needs Premium. That's why each friend uses their own Client ID. Going public would need Spotify's extended quota review.
- Lyrics licensing: LRCLIB is fine for personal use. A public, commercial launch needs a licensed provider (Musixmatch, LyricFind).
- An iOS web app can't show anything on the Lock Screen. A Lock Screen or Live Activity view needs a native Swift app (ShazamKit, ActivityKit). That's a later phase.
- Zero-API-cost idea: the meanings cache can be pre-filled with Claude Code itself (on the owner's Claude subscription, through a script that runs `claude -p` per song and upserts into `public.songs`), so his own playlists cost no API credits.

## Costs at a glance
- Claude Sonnet 5.5: about 3¢ per new song. Haiku 5.5: about 0.2¢. Each song is explained once and shared by everyone.
- AudD: 300 free recognitions, then about 0.5¢ each.
- Supabase and GitHub Pages: free tier.
