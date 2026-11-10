import { LS } from "../state.js";
import { AI_MODEL } from "../config.js";

/* ---------- Claude meanings (personal key; the backend uses the same prompt) ---------- */
export const SYSTEM = "You help people sing along to songs in languages they don't speak, and understand what each line really means.";
export function promptFor(lines, title, artist){
  return `Song: "${title}" by ${artist}

Lyric lines, numbered:
${lines.map((t, i) => `${i}: ${t}`).join("\n")}

For every numbered line give:
- r: the line in plain English letters, spelled the way fans type these lyrics in YouTube comments or WhatsApp (Punjabi, Hindi, Haryanvi: "mainu", "tenu", "kyun", "yaar", "gabru", "chhora"). No diacritics, no scholarly transliteration. Keep English words in English. If the line is already in Latin letters, copy it exactly.
- m: what the line means in this song, in natural English, at most 14 words. Translate the intent, slang and idioms, not word by word, using the rest of the song as context. Leave m empty for lines that are already plain English.
Also give language (for example "Punjabi", "Haryanvi", "Spanish", "Hindi and English") and summary: one or two sentences on what the song is about and its mood.
Return every line number exactly once.`;
}
export const TOOL = {
  name:"song_explained", description:"Romanized lyrics with a short meaning for each line",
  input_schema:{ type:"object", properties:{
    language:{ type:"string" }, summary:{ type:"string" },
    lines:{ type:"array", items:{ type:"object", properties:{ i:{ type:"integer" }, r:{ type:"string" }, m:{ type:"string" } }, required:["i","r","m"] } }
  }, required:["language","summary","lines"] }
};
export async function claudeDirect(lines, meta){
  const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST",
    headers:{ "content-type":"application/json", "x-api-key":LS.get("akey"), "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
    body:JSON.stringify({ model:AI_MODEL, max_tokens:12000, system:SYSTEM, tools:[TOOL], tool_choice:{ type:"tool", name:TOOL.name },
      messages:[{ role:"user", content:promptFor(lines, meta.title, meta.artist) }] }) });
  if(!r.ok){
    const t = await r.text(); let msg = t;
    try{ msg = JSON.parse(t).error?.message || t; }catch{}
    throw new Error("Claude " + r.status + ": " + msg.slice(0, 200));
  }
  const d = await r.json();
  const input = (d.content || []).find(c => c.type === "tool_use")?.input || {};
  const byI = new Map((input.lines || []).map(x => [Number(x.i), x]));
  return { language:String(input.language || ""), summary:String(input.summary || ""),
           lines: lines.map((text, i) => ({ text, r:String(byI.get(i)?.r || text), m:String(byI.get(i)?.m || "") })) };
}
