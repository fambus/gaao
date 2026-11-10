// Gaao backend: song recognition (AudD) and line-by-line meanings (Claude), shared across invited users.
// Routes: GET /health (add ?db=1 to ping the database too), POST /recognize (multipart "file"), POST /meanings ({ lrclib_id })
// Access: every request carries an invite code in the x-gaao-invite header (see the invites table).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3, idle_timeout: 20 });
const MODEL = Deno.env.get("GAAO_MODEL") || "claude-sonnet-5-5";
const PROMPT_VERSION = "p1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-gaao-invite, authorization, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

type Invite = { code: string; recognize_per_day: number; songs_per_day: number; share_code: string | null };
const inviteCache = new Map<string, { at: number; row: Invite | null }>();
async function getInvite(code: string | null): Promise<Invite | null> {
  if (!code || code.length > 64) return null;
  const c = inviteCache.get(code);
  if (c && Date.now() - c.at < 60_000) return c.row;
  const rows = await sql<Invite[]>`
    select code, recognize_per_day, songs_per_day, share_code from public.invites where code = ${code} and not revoked`;
  const row = rows[0] ?? null;
  inviteCache.set(code, { at: Date.now(), row });
  return row;
}
async function bump(code: string, kind: string): Promise<number> {
  const [r] = await sql`select public.gaao_bump(${code}, ${kind}) as n`;
  return Number(r.n);
}

/* ---------- recognition ---------- */
async function recognize(req: Request, inv: Invite) {
  const token = Deno.env.get("AUDD_API_TOKEN");
  if (!token) return json({ code: "not_configured", error: "Listening isn't switched on yet (AUDD_API_TOKEN missing)." }, 503);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1000 || file.size > 4_000_000)
    return json({ code: "bad_audio", error: "Send a 5 to 10 second audio clip as 'file'." }, 400);
  if (await bump(inv.code, "recognize") > inv.recognize_per_day)
    return json({ code: "limit", error: "Today's listening limit for this invite is used up. It resets at midnight." }, 429);

  const f = new FormData();
  f.append("api_token", token);
  f.append("return", "spotify,apple_music");
  f.append("market", "in");
  f.append("file", file, file.name || "clip.wav");
  const r = await fetch("https://api.audd.io/", { method: "POST", body: f });
  const d = await r.json().catch(() => ({}));
  if (d.status !== "success") return json({ code: "provider", error: d.error?.error_message || `Recognition service error (${r.status})` }, 502);
  const res = d.result;
  if (!res) return json({ match: false });

  const timecode_ms = String(res.timecode || "0:00").split(":").map(Number).reduce((a, b) => a * 60 + b, 0) * 1000;
  const sp = res.spotify || {}, am = res.apple_music || {};
  const art = sp.album?.images?.[1]?.url || sp.album?.images?.[0]?.url ||
    (am.artwork?.url ? String(am.artwork.url).replace("{w}", "300").replace("{h}", "300") : null);
  return json({
    match: true,
    title: res.title, artist: res.artist,
    album: res.album || sp.album?.name || am.albumName || "",
    timecode_ms,
    duration_ms: sp.duration_ms || am.durationInMillis || null,
    spotify_id: sp.id || null,
    art, link: res.song_link || null,
  });
}

/* ---------- meanings ---------- */
function uniqueLines(rec: { syncedLyrics?: string; plainLyrics?: string }): string[] {
  const out: string[] = [];
  if (rec.syncedLyrics) {
    for (const raw of rec.syncedLyrics.split(/\r?\n/)) {
      if (!/\[(\d+):(\d+(?:\.\d+)?)\]/.test(raw)) continue;
      out.push(raw.replace(/\[[^\]]*\]/g, "").trim());
    }
  } else if (rec.plainLyrics) {
    for (const raw of rec.plainLyrics.split(/\r?\n/)) out.push(raw.trim());
  }
  return [...new Set(out.filter(Boolean))];
}

const SYSTEM = "You help people sing along to songs in languages they don't speak, and understand what each line really means.";
function promptFor(lines: string[], title: string, artist: string) {
  return `Song: "${title}" by ${artist}

Lyric lines, numbered:
${lines.map((t, i) => `${i}: ${t}`).join("\n")}

For every numbered line give:
- r: the line in plain English letters, spelled the way fans type these lyrics in YouTube comments or WhatsApp (Punjabi, Hindi, Haryanvi: "mainu", "tenu", "kyun", "yaar", "gabru", "chhora"). No diacritics, no scholarly transliteration. Keep English words in English. If the line is already in Latin letters, copy it exactly.
- m: what the line means in this song, in natural English, at most 14 words. Translate the intent, slang and idioms, not word by word, using the rest of the song as context. Leave m empty for lines that are already plain English.
Also give language (for example "Punjabi", "Haryanvi", "Spanish", "Hindi and English") and summary: one or two sentences on what the song is about and its mood.
Return every line number exactly once.`;
}
const TOOL = {
  name: "song_explained",
  description: "Romanized lyrics with a short meaning for each line",
  input_schema: {
    type: "object",
    properties: {
      language: { type: "string" },
      summary: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: { i: { type: "integer" }, r: { type: "string" }, m: { type: "string" } },
          required: ["i", "r", "m"],
        },
      },
    },
    required: ["language", "summary", "lines"],
  },
};

async function explain(lines: string[], title: string, artist: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY")!;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 12000, system: SYSTEM,
      tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: promptFor(lines, title, artist) }],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  const input = d.content?.find((c: { type: string }) => c.type === "tool_use")?.input ?? {};
  const byI = new Map<number, { r?: string; m?: string }>((input.lines || []).map((x: { i: number }) => [Number(x.i), x]));
  return {
    language: String(input.language || ""),
    summary: String(input.summary || ""),
    model: MODEL,
    lines: lines.map((text, i) => ({ text, r: String(byI.get(i)?.r || text), m: String(byI.get(i)?.m || "") })),
  };
}

async function meanings(req: Request, inv: Invite) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.lrclib_id);
  if (!Number.isInteger(id) || id <= 0) return json({ code: "bad_request", error: "lrclib_id is required." }, 400);
  const key = `lrclib:${id}:${MODEL}:${PROMPT_VERSION}`;

  const hit = await sql`update public.songs set hits = hits + 1 where key = ${key} returning data`;
  if (hit.length) return json({ cached: true, ...hit[0].data });

  // If this song is already being explained (say, prefetch and playback at once), wait for that instead of paying twice.
  let job = inflight.get(key);
  if (!job) {
    if (!Deno.env.get("ANTHROPIC_API_KEY"))
      return json({ code: "not_configured", error: "Claude meanings aren't switched on yet (ANTHROPIC_API_KEY missing)." }, 503);
    if (await bump(inv.code, "songs") > inv.songs_per_day)
      return json({ code: "limit", error: "Today's new-song limit for this invite is used up. Songs already explained still work." }, 429);
    job = (async () => {
      const lr = await fetch(`https://lrclib.net/api/get/${id}`, { headers: { "Lrclib-Client": "Gaao (lyrics companion)" } });
      if (!lr.ok) return null;
      const rec = await lr.json();
      const lines = uniqueLines(rec);
      if (!lines.length) return { language: "", summary: "", model: MODEL, lines: [] };
      const out = await explain(lines, rec.trackName || body.title || "", rec.artistName || body.artist || "");
      await sql`
        insert into public.songs (key, title, artist, model, data)
        values (${key}, ${rec.trackName ?? null}, ${rec.artistName ?? null}, ${MODEL}, ${sql.json(out)})
        on conflict (key) do nothing`;
      return out;
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  const out = await job;
  if (!out) return json({ code: "no_lyrics", error: "Lyrics not found." }, 404);
  return json({ cached: false, ...out });
}
const inflight = new Map<string, Promise<Record<string, unknown> | null>>();

/* ---------- router ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  try {
    const inv = await getInvite(req.headers.get("x-gaao-invite"));
    if (path.endsWith("/health")) {
      // ?db=1 also runs a query, so the weekly keep-alive counts as database activity (free projects pause when idle).
      const db = url.searchParams.has("db") ? { db: (await sql`select 1 as ok`).length === 1 } : {};
      return json({
        ok: true, invite: !!inv, share_code: inv?.share_code ?? null, model: MODEL,
        listen: !!Deno.env.get("AUDD_API_TOKEN"), meanings: !!Deno.env.get("ANTHROPIC_API_KEY"), ...db,
      });
    }
    if (!inv) return json({ code: "invite", error: "This link's invite code isn't valid. Ask for a fresh Gaao link." }, 401);
    if (req.method === "POST" && path.endsWith("/recognize")) return await recognize(req, inv);
    if (req.method === "POST" && path.endsWith("/meanings")) return await meanings(req, inv);
    return json({ code: "not_found", error: "Unknown route." }, 404);
  } catch (e) {
    console.error(e);
    return json({ code: "server", error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
