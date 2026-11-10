# Gaao

**Sing along to any song, in any language.** Gaao shows the lyrics of the song that's playing in English letters, with a one-line English meaning under each line, in time with the music. It was built for Punjabi, Haryanvi, Hindi/Urdu and Spanish songs.

Open it: **https://fambus.github.io/gaao/**

<p>
  <img src="docs/screenshot-welcome.png" alt="Gaao welcome screen on a phone" width="260">
  <img src="docs/screenshot-iphone.png" alt="Gaao showing romanized Punjabi lyrics with meanings" width="260">
</p>

*(The lyrics in the screenshot are made-up test lines.)*

## What it does today

- **Listen:** hold your phone near the music for 8 seconds. Gaao recognises the song and jumps to the right line.
- **Follow Spotify:** connect your own Spotify app and Gaao follows what you play, in sync.
- **English letters:** Punjabi (Gurmukhi) and Hindi/Haryanvi (Devanagari) are romanized on the phone, instantly and offline, the way people type lyrics in chat ("mainu", "yaar").
- **Meanings:** Claude explains each line in context (slang and idioms, not word by word). Each song is explained once and the result is shared by everyone. Free translators fill in when Claude is off.

Where this is going (Apple Music and YouTube Music users, an installable app, a desktop floating window, a free trial without an invite) is in [PLAN.md](PLAN.md).

## How it's built

| Part | Where | Notes |
|---|---|---|
| Front end | `index.html`, `src/` | Vanilla JavaScript modules, built with Vite, served by GitHub Pages |
| Backend | `supabase/functions/gaao/index.ts` | One Supabase edge function: `/health`, `/recognize` (AudD), `/meanings` (Claude) |
| Database | `supabase/migrations/` | `songs` (shared meanings cache), `invites`, `usage` (daily caps) |
| Lyrics | [LRCLIB](https://lrclib.net) | Free and open, no key |

No API key ever reaches the browser or this repo. Paid calls go through the edge function, which checks an invite code and a daily cap first.

## Run it on your computer

You need Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173/gaao/. Without a backend, lyrics, local romanization and the free translators still work.

### Tests

```bash
npm test
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

The end-to-end tests run at iPhone size (390x844) and desktop size (1440x900) with a fake microphone and a mocked backend. Screenshots land in `test-results/shots/`.

## Host your own backend

1. Create a free project at [supabase.com](https://supabase.com) and copy its project ref.
2. Point the front end at it: change `BACKEND` in `src/config.js`, and `GAAO_BACKEND` in `.github/workflows/keepalive.yml`.
3. Log in and link (this opens your browser; the token is stored by the CLI, not in this repo):

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Create the tables and deploy the function:

   ```bash
   npx supabase db push
   ```

   ```bash
   npx supabase functions deploy gaao --no-verify-jwt
   ```

5. Add the secrets in the Supabase dashboard under **Edge Functions → Secrets** (names are in [.env.example](.env.example)):
   - `AUDD_API_TOKEN` from [dashboard.audd.io](https://dashboard.audd.io) switches on Listen.
   - `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com) switches on Claude meanings.
   - `GAAO_MODEL` is optional (`claude-haiku-5-5` is the cheap choice).
6. Create an invite for yourself in the dashboard's SQL editor, with a code only you know:

   ```sql
   insert into public.invites (code, label) values ('PUT-A-LONG-RANDOM-CODE-HERE', 'me');
   ```

   Then open `https://YOUR-SITE/?invite=<your-code>` once on each device.
7. Check it:

   ```bash
   curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/gaao/health
   ```

   `listen` and `meanings` should both be `true`.

Pushing to `main` builds and publishes the site (`.github/workflows/deploy.yml`). In the repo's **Settings → Pages**, the source must be **GitHub Actions**.

### Keeping secrets out of git

- `.env` files are ignored; only `.env.example` (names, no values) is tracked.
- `npm run check:secrets` scans every tracked file for key-shaped strings. CI runs it on every push.
- Invite codes live only in the `invites` table.

## What it costs to run

| Service | Free allowance | After that |
|---|---|---|
| Claude meanings | none | about 0.2¢ per new song on Haiku 5.5, about 3¢ on Sonnet 5.5; a song is only ever explained once |
| AudD recognition | 300 requests | about 0.5¢ per Listen |
| Supabase, GitHub Pages, LRCLIB | free tier | free |

Supabase pauses free projects after about a week without use. `.github/workflows/keepalive.yml` pings the backend twice a week to prevent that.

## Privacy

- The microphone is used only when you tap Listen, for about 8 seconds. The clip goes to the Gaao backend and on to AudD for recognition; Gaao doesn't store it.
- Lyric lines are sent to Claude (through the backend) or to free translators (Google Translate, MyMemory) to get their meanings.
- Your Spotify login, settings and any personal API key stay in your browser's storage on your device.
- The backend stores which songs have been explained and a daily count per invite code. It stores nothing about who you are.

## Limits worth knowing

- Lyrics come from LRCLIB and are for personal use. A commercial launch would need a licensed lyrics provider.
- Spotify's developer mode allows 5 users per app, so each person connects their own Spotify app.
- A web app can't show anything on the iPhone Lock Screen.

## License

Code: [MIT](LICENSE). Song lyrics belong to their owners and are not part of this repository.
