// Shared mocks for the end-to-end tests: no real network call leaves the browser.
import fs from "node:fs";
import path from "node:path";

export const SHOT_DIR = process.env.GAAO_SHOT_DIR || "test-results/shots";

// Made-up Punjabi lines (not from any real song), one every 4 seconds.
const TEXTS = [
  "ਤੇਰੇ ਬਿਨਾ ਦਿਲ ਨਹੀਂ ਲੱਗਦਾ",
  "ਚੰਨ ਵਰਗਾ ਮੁਖੜਾ ਤੇਰਾ",
  "ਆਜਾ ਨੱਚ ਲੈ ਮੇਰੇ ਨਾਲ",
  "ਸਾਰੀ ਰਾਤ ਗੱਲਾਂ ਕਰੀਏ",
  "ਮੈਨੂ ਮੇਰੇ ਯਾਰ ਮੋੜ ਦੋ",
];
const MEANINGS = [
  ["Tere bina dil nahi lagda", "My heart finds no peace without you"],
  ["Chann varga mukhda tera", "Your face glows like the moon"],
  ["Aaja nach lai mere naal", "Come on, dance with me"],
  ["Saari raat gallan kariye", "Let's talk the whole night through"],
  ["Mainu mere yaar mod do", "Give me my friends back"],
];
const stamp = s => `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.00]`;

export const SONG = {
  id: 424242,
  trackName: "Test Geet",
  artistName: "Gaao Band",
  albumName: "Fixtures",
  duration: 180,
  instrumental: false,
  plainLyrics: TEXTS.join("\n"),
  syncedLyrics: Array.from({ length: 30 }, (_, i) => `${stamp(i * 4)} ${TEXTS[i % TEXTS.length]}`).join("\n"),
};

export const HEALTH = { ok: true, invite: true, share_code: "share-code-1", model: "claude-haiku-5-5", listen: true, meanings: true };

export const AI = {
  cached: true,
  language: "Punjabi",
  summary: "A playful love song: the singer can't sit still without their sweetheart and wants to dance all night.",
  model: "claude-haiku-5-5",
  lines: TEXTS.map((text, i) => ({ text, r: MEANINGS[i][0], m: MEANINGS[i][1] })),
};

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const reply = (route, body, status = 200) =>
  route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });

/**
 * Mock every external service the app talks to.
 * opts.health / opts.ai / opts.song replace the defaults; pass ai:null to make /meanings fail (free path only).
 */
export async function mockAll(page, opts = {}) {
  const health = opts.health ?? HEALTH, song = opts.song ?? SONG, ai = opts.ai === undefined ? AI : opts.ai;
  const calls = { recognize: 0, meanings: 0, lrclib: 0, translate: 0 };

  await page.route("**/functions/v1/gaao/**", route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.endsWith("/health")) return reply(route, health);
    if (url.pathname.endsWith("/recognize")) {
      calls.recognize++;
      return reply(route, { match: true, title: song.trackName, artist: song.artistName, album: song.albumName,
        timecode_ms: 2000, duration_ms: song.duration * 1000, spotify_id: null, art: null, link: null });
    }
    if (url.pathname.endsWith("/meanings")) {
      calls.meanings++;
      return ai ? reply(route, ai) : reply(route, { code: "not_configured", error: "Claude meanings aren't switched on yet." }, 503);
    }
    return reply(route, { code: "not_found", error: "Unknown route." }, 404);
  });

  await page.route("https://lrclib.net/api/**", route => {
    calls.lrclib++;
    const url = new URL(route.request().url());
    return reply(route, url.pathname.endsWith("/search") ? [song] : song);
  });

  // Free translators: answer in each engine's own response shape.
  await page.route("https://translate.googleapis.com/**", route => {
    calls.translate++;
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    const i = TEXTS.indexOf(q.trim());
    const m = i >= 0 ? MEANINGS[i] : [q, "meaning of: " + q];
    return reply(route, [[[m[1], q, null, null, 3], [null, null, null, m[0].toLowerCase()]], null, "pa"]);
  });
  await page.route("https://clients5.google.com/**", route => reply(route, ["mock meaning"]));
  await page.route("https://api.mymemory.translated.net/**", route =>
    reply(route, { responseStatus: 200, responseData: { translatedText: "mock meaning" } }));
  await page.route("https://api.anthropic.com/**", route => reply(route, { error: { message: "mocked off" } }, 401));
  await page.route("https://api.spotify.com/**", route => reply(route, {}, 401));
  await page.route("https://accounts.spotify.com/**", route => reply(route, { error: "mocked off" }, 400));

  return calls;
}

export async function shot(page, testInfo, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
