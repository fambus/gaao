import { LS, S, $ } from "./state.js";
import { findLyrics } from "./lyrics/lrclib.js";
import { parseLRC } from "./lyrics/parse.js";
import { romanize } from "./roman/local.js";
import { isLatin, plainify } from "./roman/latin.js";
import { aiAvailable, getAI } from "./meanings/backend.js";
import { viaFree } from "./meanings/free.js";
import { render, paintLine, setAbout, setChip, showMsg } from "./ui/render.js";

/* ---------- track loading ---------- */
export async function loadTrack(item){
  const gen = ++S.gen;
  S.id = item.id; S.lines = []; S.idx = -1; S.synced = false; S.about = null;
  const meta = { title:item.name, artist:(item.artists || []).map(a => a.name).join(", ") };
  $("title").textContent = meta.title;
  $("artist").textContent = meta.artist + (S.mode === "listen" ? " · heard nearby" : "");
  const img = item.album?.images?.slice(-1)[0]?.url || item.album?.images?.[0]?.url;
  if(img) $("art").src = img; else $("art").removeAttribute("src");
  setChip("Finding lyrics");
  showMsg("Finding lyrics", meta.title);

  const cacheKey = "v3:song:" + item.id;
  let c = null;
  try{ c = JSON.parse(LS.get(cacheKey) || "null"); }catch{}
  if(!c){
    const found = await findLyrics(item);
    if(gen !== S.gen) return;
    if(!found){ setChip("No lyrics"); showMsg("No lyrics found", "LRCLIB doesn't have this song yet."); return; }
    if(found.instrumental){ setChip("Instrumental"); showMsg("Instrumental", "Nothing to sing here. Enjoy it."); return; }
    let lines, synced;
    if(found.syncedLyrics){ synced = true; lines = parseLRC(found.syncedLyrics).map(l => ({ t:l.t, text:l.text })); }
    else { synced = false; lines = found.plainLyrics.split(/\r?\n/).map(text => ({ t:null, text:text.trim() })); }
    lines.forEach(l => { if(l.text) l.r = romanize(l.text); });
    c = { lines, synced, lrcId:found.id, engine:null, about:null };
  }
  S.lines = c.lines; S.synced = c.synced; S.about = c.about;
  render();
  const liveChip = () => setChip(c.synced ? "Live" : "Unsynced", c.synced ? "live" : "");
  liveChip();
  if(c.engine === "ai" || (c.engine === "free" && !aiAvailable())) return;

  const lines = c.lines;
  const uniq = [...new Set(lines.map(l => l.text).filter(Boolean))];
  let aiDone = false;
  const stop = () => aiDone || gen !== S.gen;
  const applyFree = (text, m) => lines.forEach((l, i) => { if(l.text === text && l.m === undefined){ l.m = m; paintLine(i); } });

  if(aiAvailable()){
    setChip("Explaining…");
    // free meanings fill in if Claude takes more than a few seconds; Claude's replace them when ready
    let interim = null;
    const timer = setTimeout(() => { if(!stop()) interim = viaFree(uniq, applyFree, stop); }, 3500);
    let ai = null;
    try{ ai = await getAI(c.lrcId, uniq, meta); }catch(e){ console.warn(e); }
    clearTimeout(timer);
    if(gen !== S.gen) return;
    if(ai && ai.lines?.length){
      aiDone = true;
      const byText = new Map(ai.lines.map(x => [x.text, x]));
      lines.forEach((l, i) => {
        const x = byText.get(l.text);
        if(x){ l.r = isLatin(l.text) ? l.text : plainify(x.r || l.r || l.text); l.m = x.m || ""; paintLine(i); }
      });
      c.about = S.about = { language:ai.language || "", summary:ai.summary || "" };
      setAbout();
      c.engine = "ai";
      LS.set(cacheKey, JSON.stringify(c));
      liveChip();
      return;
    }
    if(interim) await interim;
  }

  const missing = uniq.filter(t => lines.some(l => l.text === t && l.m === undefined));
  await viaFree(missing, applyFree, () => gen !== S.gen);
  if(gen !== S.gen) return;
  const have = uniq.filter(t => lines.some(l => l.text === t && l.m)).length;
  if(!have){
    setChip("No meanings", "err");
    lines.forEach((l, i) => { if(l.text){ l.m = "Couldn't get a meaning. Open ⚙︎ and tap Test connections."; paintLine(i); } });
    return;
  }
  liveChip();
  if(have / uniq.length >= 0.7){ c.engine = "free"; LS.set(cacheKey, JSON.stringify(c)); }
}
