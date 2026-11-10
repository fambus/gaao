# Gaao: plan to a public, any-device release

## Context
Gaao shows the lyrics of the song that's playing in English letters, with a one-line English meaning under each line, synced to the music. Today it is one 1,107-line `index.html` plus a Supabase edge function. It isn't a git repo, it has no tests, and it only works smoothly for Spotify users.

**Goal:** a public GitHub project that Reddit users can try for free on iPhone, Android, Windows and Mac. Apple Music and YouTube Music users must be covered too. The app has to stay within a budget of about $5 a month, and macOS has to work flawlessly.

**Live state, checked on 10 Nov 2026**
- Supabase project `oqznbxiibpiocvwoqexj` is ACTIVE.
- Function `gaao` is at v2. `/health` returns `listen:false, meanings:false`, which means no secrets are set. The live default model is Sonnet 5.5.
- The `invites`, `songs` and `usage` tables all have **0 rows**, so the owner's invite code is gone.
- Not installed on this PC: git, gh, supabase CLI, deno, claude CLI and Playwright. Node 20 and Python 3.12 are installed.
- Google `translate_a/single?client=gtx&dt=t&dt=rm` returns a romanization for Urdu, tested live: `roi ki tarah ad jain ge`.

**Your decisions**
- Mac must be flawless. You have a Mac but no Apple Developer account.
- The build approach is my call, optimised for the smoothest onboarding for phone users on any streaming service.
- Public Reddit launch. Signed-in users get a free trial, then bring their own key ("developer mode"). There's a tip jar that unlocks nothing.
- Budget is about $5 a month.
- Sign-in is Google only.
- Tip jar: whatever is free and keeps you pseudonymous.

**FloatLyrics decision:** it is Mac-only Electron, has **no license**, and has no hook for a second line under each lyric. We won't copy its code or feed data into it. Gaao gets:
- its own MIT-licensed desktop overlay app (Electron, written from scratch);
- Document Picture-in-Picture in Chrome and Edge.

## Architecture decisions
- **Front end:** Vite with vanilla JS ES modules and no framework. GitHub Actions builds it and deploys to Pages at base `/gaao/`. Modules: `src/{main,config,state,sync}.js`, `src/lyrics/{lrclib,parse}.js`, `src/roman/{local,translit,pipeline}.js`, `src/meanings/{backend,direct,free}.js`, `src/sources/{spotify,listen,search,link,desktop}.js`, `src/ui/*`, `src/auth.js`, `src/pip.js`, `public/{manifest.webmanifest,icons,sw.js}`.
- **Song sources:** a web page on a phone can't see what another app is playing, so there are several ways in.
  1. **Search** and **paste or share a link**. Apple Music and YouTube Music links are resolved through the Odesli API and iTunes Lookup, and Spotify links through oEmbed. Android uses a PWA `share_target`. iPhone gets a paste button.
  2. **Tap to sync:** tap "it started now" or tap the line you hear. Both are free.
  3. **Listen** through the mic and AudD. This costs money, so it's for trial or own-key users.
  4. **Follow Spotify** with your own Client ID, inside developer mode.
  5. **Desktop app:** on Mac it follows **Spotify and Apple Music** natively through AppleScript, with no mic and no cost.
- **Romanization order (bug fix):** the local romanizer runs instantly, Google `dt=rm` fills in other scripts, and Claude's `r` replaces both when it arrives. If all three fail, the offline `any-ascii` library (ISC license, lazy-loaded) is the last resort. A non-Latin line is **never** the main line unless "Show original script" is on.
- **Cost control:** meanings are cached per song and shared by everyone.
  - **Everyone, no sign-in:** cached meanings, the free translators and transliteration, search and tap to sync.
  - **Signed in with Google:** a trial of **10 new-song Claude explanations and 5 Listens**. These numbers are configurable.
  - **After the trial:** your own Anthropic key (stays in the browser) and your own AudD token.
  - **Friends:** invites still work for friend-level caps.
  - **Global caps:** a monthly and daily spend cap in the backend (`GAAO_MONTHLY_BUDGET_CENTS=500`). Cost is worked out from each Claude response's token usage and AudD's price per call. Each IP is also limited per day, and Cloudflare Turnstile checks paid calls for bots.
- **Sign-in:** Supabase Auth with Google through the **ID-token flow** (Google's own button plus `signInWithIdToken`), so the iPhone Home Screen app never has to handle a redirect. The backend verifies the Supabase JWT.
- **Model:** `GAAO_MODEL` defaults to `claude-haiku-5-5`. `claude-sonnet-5-5` is an option for owner and friend plans and for users with their own key.
- **Cache key is no longer tied to a model:** `lrclib:{id}:p2`, with the model stored in a column, so the `claude -p` pre-fill can be used by the backend.

## Tools to install (I'll confirm each one with you before installing)
| Tool | How | Scope |
|---|---|---|
| Git and GitHub CLI | `winget install Git.Git GitHub.cli` | system-wide |
| Supabase CLI | `npm i -D supabase` | project only |
| Playwright with Chromium | `npm i -D @playwright/test` + `npx playwright install chromium`, about 150 MB | project and user cache |
| Deno, to run and test the function locally without Docker | `winget install DenoLand.Deno` | system-wide |
| claude CLI, for the pre-fill script only | `npm i -g @anthropic-ai/claude-code` | system-wide |

You run `gh auth login`, `npx supabase login` and `claude` login yourself.

## Existing files that will change
These are files you created, and approving this plan approves these changes:
- `index.html` gets ported into `src/` and becomes the Vite entry.
- `CLAUDE.md` and `HANDOFF.md` get updated.
- `KICKOFF_PROMPT.md` moves to `docs/`.
- `.gitignore` gets extended.
- `supabase/functions/gaao/index.ts` gets refactored.
- New migrations get added.

I won't delete anything else.

---

## Phase A: repo and backend hygiene
**What happens, in order:**
1. Write `PLAN.md`, which is this plan, into the repo.
2. `git init`. Then `gh repo view fambus/gaao`. If the repo exists, fetch it and commit on top of its history. **No force-push.** If the histories have diverged, I ask you first.
3. Port to Vite with **no change in behaviour**: `package.json`, `vite.config.js`, `index.html` as the shell, and `src/` modules.
4. GitHub Actions:
   - `deploy.yml` builds and deploys to Pages.
   - `keepalive.yml` runs weekly on a cron plus a manual trigger and calls `curl /health?db=1`. `/health` gets a `select 1` so the database sees activity. A function call on its own may not count.
   - `ci.yml` runs the tests.
5. Add `README.md` (what Gaao is, a GIF, self-hosting, costs, privacy), the MIT `LICENSE`, `.env.example` and `supabase/config.toml`.
6. `npx supabase link` and `npx supabase functions deploy gaao --no-verify-jwt`.
7. Check whether `pg_net` is used anywhere. If it isn't, add a migration that drops it.
8. Add a secret scan in CI with a simple regex check, plus a pre-commit note.

**Secrets checklist for you:**
- **Supabase dashboard**, Project → Edge Functions → Secrets: `ANTHROPIC_API_KEY`, `AUDD_API_TOKEN`, `GAAO_MODEL=claude-haiku-5-5`. Later phases add `GENIUS_ACCESS_TOKEN`, `TURNSTILE_SECRET`, `GAAO_ADMIN_TOKEN` and `GAAO_MONTHLY_BUDGET_CENTS`.
- **Your owner invite:** you insert it yourself with SQL in the dashboard. I'll give you a template with a placeholder.
- **No GitHub secrets** are needed for Phase A.

**How I'll verify Phase A:**
- `npm run build`, and `node --check` on the output.
- Playwright smoke test at 390x844 and 1440x900 with a mocked backend. The screenshots must match the current UI.
- `curl /health` before and after deploy.
- `gh run list` shows the Actions passing.
- `git ls-files` contains nothing secret.

## Phase B: romanization bug
**What changes:**
- `src/roman/translit.js` calls Google gtx with `dt=rm` and batches lines (one call can carry several lines separated by newlines). It also returns meanings, so it merges with the free translator engines.
- `src/roman/pipeline.js` sets a line's `rState` to `local`, `translit`, `ai` or `ascii` and picks the best one available. It is wired into `loadTrack` and `paintLine`. Claude's `r` is used only if it is Latin; otherwise the line falls back.
- Backend: don't cache a result if any `r` is still non-Latin for a non-Latin source, or if fewer than 90% of lines are covered (currently both are cached, against the rule in CLAUDE.md). Missing lines are filled from the free path in the browser.
- Add `any-ascii` as the final fallback.

**Tests:**
- `tests/roman.test.js` (Vitest) uses sample lines in Gurmukhi, Devanagari, Urdu (the Hum Dekhenge lines) and Spanish. It checks that:
  - each output is Latin-only;
  - Spanish comes back unchanged;
  - the pipeline prefers Claude over transliteration over the local romanizer when given mocked inputs;
  - with "show original" off, a raw script line is never rendered.
- Plus one opt-in live test, `npm run test:live`, for `dt=rm`.

**How I'll verify Phase B:** `npm test` output, plus Playwright screenshots of Hum Dekhenge with mocked LRCLIB and the backend switched off. They must show romanized lines like the bug screenshot, but fixed.

## Phase C: meanings quality, model, pre-fill and Genius
**What changes:**
- **New prompt, `p2`:** it adds slang, idioms, poetic and Sufi/Urdu imagery, cultural and religious references, and Punjabi/Haryanvi colloquialisms.
- **New tool schema:** `{language, summary, mood, lines:[{i,r,m,note?}]}`. `note` is an optional short explanation of a reference.
- Bump the front-end cache to `v4:song:` and set `PROMPT_VERSION=p2`.
- **Summary card:** shown under the song header, tap to expand. It also shows `note` badges on lines.
- **Model selection:** `GAAO_MODEL` defaults to Haiku. The request can say `quality:"high"`, which uses Sonnet only for plans that allow it. The model is recorded in `songs.model`.
- **Genius, optional:** if `GENIUS_ACCESS_TOKEN` is set, use the official `/search` and `/songs/:id` (description, metadata) as short context for Claude. Genius content is not shown to users and nothing is scraped.
- **Spend tracking:** a migration adds a `spend` table (day, cents). Each Claude and AudD call records its cost, and the global cap returns 429 `budget` once it's reached.
- **Pre-fill script, `scripts/prefill.mjs`:**
  - **Input:** a text or CSV file of `Artist - Title`, or a Spotify playlist URL read with your own token.
  - **Steps:** find each song on LRCLIB, run `claude -p` with the same prompt and a JSON schema, then validate the result (Latin `r`, full coverage).
  - **Upload:** to the new admin route `/admin/upsert`, which needs the `x-gaao-admin` header.
  - **Admin token:** comes from an environment variable that you set with a hidden prompt, using a helper `scripts/set-admin-token.ps1` with `Read-Host -AsSecureString`.

**How I'll verify Phase C:**
- Deno unit tests for the function: prompt, validation, cache keys and budget, all with mocked Claude and DB.
- Deploy, then one real `/meanings` call on a cached test song, done only once you've set the key.
- `node scripts/prefill.mjs --dry-run` on 2 songs, plus 1 real run if you approve.
- Screenshots of the summary card at both sizes.

## Phase D1: any device, web
**What changes:**
- **PWA:** `manifest.webmanifest` (icons 192, 512 and maskable, `apple-touch-icon`, Android `share_target`) and `sw.js`. The service worker caches the app shell and the last 50 songs' lyrics and meanings for offline use, and never caches API calls to the backend.
- **Responsive desktop layout:** two columns at 1024px and wider (lyrics plus a side panel), with larger type.
- **Keyboard shortcuts:**

  | Key | Action |
  |---|---|
  | Space | sync tap |
  | ←/→ | ±0.5 s offset |
  | L | Listen |
  | / | search |
  | P | Picture-in-Picture |
  | O | show original script |
  | ? | help |

- **Song sources:** search, paste link, share target, tap to sync, as listed under Architecture.
- **Document Picture-in-Picture mini window:** compact mode (current and next line) or focus mode (current line only), with glass styling. Hidden where the browser doesn't support it.

**How I'll verify D1:**
- Playwright at both sizes:
  - Lighthouse PWA installability checks via manifest and SW assertions.
  - Offline reload shows the cached song.
  - A pasted Apple Music link resolves, with mocked Odesli.
  - Tap to sync moves the line.
  - Keyboard shortcuts work.
- PiP opens in Chromium, plus a screenshot of the PiP window.

## Phase D2: desktop app, flawless on Mac
**What we build:** an MIT Electron app in `desktop/`, written from scratch.
- **Window:** a frameless, always-on-top floating panel (macOS `floating` and `visibleOnAllWorkspaces` levels) with optional transparency and a click-through toggle.
  - It remembers its position and size per display.
  - Compact or focus mode.
  - Tray / menu-bar icon.
  - `Cmd/Ctrl+Shift+L` shows or hides it; `Cmd/Ctrl+Shift+K` toggles click-through.
- **Content:** it loads the hosted Gaao with `?desktop=1`, so updates arrive without reinstalling. A bundled offline copy is used if loading fails.
- **Now-playing bridge:**
  - On Mac, `osascript` reads the Spotify and Music apps every second (title, artist, duration, position, Spotify track id). It is only queried while the app is running, so the player isn't launched.
  - The preload script exposes `gaaoDesktop.onNowPlaying`. The web app adds a `desktop` source that reuses the clock in `sync.js`.
- **Mac permissions:** `NSAppleEventsUsageDescription` and `NSMicrophoneUsageDescription`.
- **Windows:** same window, with Listen, search and Spotify sources. Reading the system now-playing on Windows (SMTC) is out of scope.
- **Builds:**
  - electron-builder makes a universal DMG for Mac, ad-hoc signed and not notarized, and an NSIS installer for Windows.
  - A GitHub Actions matrix on `macos-latest` and `windows-latest` attaches them to a GitHub Release.
  - The README explains how to open an unsigned app on macOS 15: System Settings → Privacy & Security → "Open Anyway".

**How I'll verify D2:**
- On this PC: run the Windows build. Playwright `_electron` checks always-on-top, the bridge with a fake now-playing provider, and takes a screenshot.
- On the macOS CI runner: `--smoke-test` launches the app, loads the page and checks the bridge. It runs the AppleScript provider against a stub, saves `capturePage` as an artifact, and exits 0. I show you the runner logs and the screenshot.
- **Real Mac check by you:** open the DMG, allow Automation, and play a song in Spotify and in Apple Music. I'll give you a 2-minute checklist. I won't call the Mac flawless until you confirm.

## Phase E: public launch, onboarding and polish
**Sign-in and trial:**
- Supabase Auth with Google using the ID-token flow.
- Migration `profiles(user_id, plan, trial_songs, trial_listens)`.
- The backend accepts either a JWT or an invite. Its checks in order: the IP cap, Turnstile, the trial or plan counters, then the global budget.
- Clear 429 messages that lead to "Use your own key" (developer mode: an Anthropic key in the browser, an AudD token forwarded and never stored).

**Tip jar:** a `TIP_URL` setting. I recommend a **Ko-fi page under the name "Gaao"**, paid out to PayPal. It's free and shows no real name publicly, though payout providers still need your ID privately. Until you give me the URL, no link is shown.

**Onboarding, from link to singing in under 30 s:**
1. The welcome screen asks "What are you listening on?" with Spotify, Apple Music / YouTube / other, and Desktop.
2. Each choice leads to a single next action.
3. Sign-in is only asked for when the user starts a trial-gated action.

**Polish:**
- Smooth line transitions (transform and opacity, respecting reduced motion).
- Empty and error states: no lyrics, instrumental, budget hit, offline.
- Better match rate: strip "feat." and "(From …)", fall back across title and artist variants, and allow a wider duration tolerance for plain lyrics.
- A privacy page and a short terms page that state lyrics come from LRCLIB and are for personal use only.

**Google setup checklist for you:** in Google Cloud Console, create an OAuth client of type Web with the Pages origin, then paste the Client ID into Supabase Auth → Google. The Client ID itself is public and goes in the config.

**How I'll verify Phase E:**
- A timed Playwright run from link to synced lyrics with a mocked backend, asserting under 30 s of simulated taps.
- Screenshots of each state at both sizes.
- Deno tests for the order of trial, cap and budget checks.
- **On your iPhone:** Google sign-in inside the Home Screen app, the mic via Listen, and add to Home Screen. Listen has never been confirmed on a real iPhone, so this is required.

---

## Every phase ends the same way
1. Run the checks and show you the output and screenshots.
2. A fresh review subagent compares the diff against PLAN.md and reports gaps only.
3. Fix those gaps.
4. Commit with a clear message, e.g. `phase B: romanize every script (translit + any-ascii fallback)`.
5. Push after Phase A, once the repo is linked.

## Out of scope for now
- Real payments or checkout.
- A licensed lyrics provider (Musixmatch or LyricFind).
- Apple notarization (needs the $99 developer program).
- A native iOS app, Lock Screen or Live Activities.
- Reading system now-playing on Windows (SMTC) and Android.
- Last.fm following.
- Spotify extended quota.
- Feeding into or modifying FloatLyrics.
- Scraping Genius or any other lyrics site.

## Risks and open items
- iPhone Google sign-in in standalone mode and the Listen feature on a real device can only be confirmed by you on your phone.
- A $5/month cap means Listen will run out quickly on Reddit traffic. That's by design: the free path is search plus tap to sync.
- LRCLIB lyrics stay personal-use only; the terms page says so.
