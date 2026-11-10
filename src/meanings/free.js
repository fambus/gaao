import { scriptLang } from "../roman/local.js";

/* Free translators, used only when Claude isn't available or is still working. */
const enc = encodeURIComponent;
function httpErr(r){ return new Error("HTTP " + r.status); }
function firstString(d){ if(typeof d === "string") return d; if(Array.isArray(d)) for(const x of d){ const s = firstString(x); if(s) return s; } return ""; }
export const ENGINES = {
  "Google": async t => {
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=" + enc(t));
    if(!r.ok) throw httpErr(r);
    const d = await r.json();
    return (d?.[0] || []).map(s => s?.[0] || "").join("").trim();
  },
  "Google (alt)": async t => {
    const r = await fetch("https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=en&q=" + enc(t));
    if(!r.ok) throw httpErr(r);
    return firstString(await r.json()).trim();
  },
  "MyMemory": async t => {
    const r = await fetch("https://api.mymemory.translated.net/get?langpair=" + scriptLang(t) + "|en&q=" + enc(t));
    if(!r.ok) throw httpErr(r);
    const d = await r.json();
    if(+d.responseStatus !== 200) throw new Error(d.responseDetails || "refused");
    return String(d.responseData?.translatedText || "").trim();
  }
};
const engineState = {};
export const blocked = e => e.message === "Load failed" || e.message === "Failed to fetch" ? "blocked by the browser" : e.message;
export async function meaningOf(text){
  let lastErr = null;
  for(const name of Object.keys(ENGINES)){
    if(engineState[name] === "dead") continue;
    try{
      const m = await ENGINES[name](text);
      if(!m) throw new Error("empty answer");
      engineState[name] = "ok";
      return m;
    }catch(e){
      lastErr = new Error(name + ": " + blocked(e));
      if(engineState[name] !== "ok") engineState[name] = "dead";
    }
  }
  throw lastErr || new Error("no translator available");
}
export async function viaFree(texts, onEach, stop){
  let i = 0, good = 0;
  async function worker(){
    while(i < texts.length && !stop()){
      const t = texts[i++];
      let m = "";
      try{ m = await meaningOf(t); good++; }catch{}
      if(!stop()) onEach(t, m);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return good;
}
