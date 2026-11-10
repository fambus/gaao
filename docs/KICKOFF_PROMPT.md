Paste everything below the line into Claude Code, started in the gaao folder, with plan mode on (Shift+Tab until it shows "plan mode on").

---

You're taking over Gaao, my sing-along lyrics web app. Read @CLAUDE.md and @HANDOFF.md first. They have the architecture, live state, known bug and goals. The FloatLyrics project I already use is at: <PASTE PATH TO FLOATLYRICS FOLDER>.

Goal for this project: turn Gaao into a finished, public GitHub project that works on any device (iPhone, Android, Windows/Mac desktop), with properly contextual meanings and FloatLyrics integrated.

Phase 0, before writing any code (plan mode):
1. Explore this repo and the FloatLyrics folder. Use subagents for the FloatLyrics deep-dive so your main context stays clean. Tell me in a few lines what FloatLyrics is (stack, how it gets lyrics and playback state, how it draws the floating window, its license) and the two or three realistic ways to integrate it with Gaao, with your recommendation.
2. Interview me with AskUserQuestion about anything the docs leave open: the desktop approach, whether Gaao stays a single HTML file or moves to a small Vite build, how public the launch is, and the budget for AudD and the Claude API.
3. Write PLAN.md with phases, the files each phase touches, what is out of scope, and how each phase will be verified. Wait for my approval.

Then execute phase by phase, in this order, committing after each phase with a clear message:
- A. Repo and backend hygiene: set up a git repo connected to github.com/fambus/gaao (use the gh CLI), add a README, keep secrets out of git, check that the Supabase CLI deploy works (`supabase link`, `functions deploy gaao --no-verify-jwt`), and add a weekly keep-alive GitHub Action for /health. Tell me exactly which secrets to paste where; never ask me to paste keys into the chat.
- B. Fix the romanization bug in docs/bug-urdu-not-romanized.png: every non-Latin script must show in English letters (Claude's `r` first, then a free transliteration fallback, then the local romanizer). Add a small test script with sample lines in Gurmukhi, Devanagari, Urdu and Spanish, and make it pass.
- C. Meanings quality: improve the Claude prompt (slang, idioms, poetic and cultural references, a song summary shown in the UI), make the model configurable (Haiku 5.5 by default, Sonnet 5.5 as an option), bump the cache versions, and add a script that pre-fills the meanings cache for a playlist using `claude -p` on my own subscription. Genius only through its official API, as optional context; no scraping.
- D. Any device: an installable PWA (manifest, icons, service worker), a responsive layout for desktop, and FloatLyrics integration or a floating mini window per the approved plan.
- E. Polish and onboarding: a friend should go from link to singing in under 30 seconds.

Verification rules for every phase: run the checks yourself and show me evidence (command output or Playwright screenshots at iPhone 390x844 and desktop 1440x900, with a fake mic and a mocked backend where needed). At the end of each phase, have a fresh subagent review the diff against PLAN.md and report only gaps in correctness or requirements. Don't tell me something works unless you ran it.
