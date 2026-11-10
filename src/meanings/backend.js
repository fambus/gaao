import { BACKEND } from "../config.js";
import { LS, B, bus } from "../state.js";
import { claudeDirect } from "./direct.js";

/* ---------- backend ---------- */
export async function api(path, opts = {}){
  const headers = Object.assign({ "x-gaao-invite": LS.get("invite") || "" }, opts.headers || {});
  let r;
  try{ r = await fetch(BACKEND + path, { ...opts, headers }); }
  catch{ throw Object.assign(new Error("Can't reach Gaao's server. Check your internet connection."), { code:"network" }); }
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw Object.assign(new Error(j.error || ("Server error " + r.status)), { code:j.code, status:r.status });
  return j;
}
export async function checkBackend(){
  try{ Object.assign(B, await api("/health"), { ok:true }); }catch{ B.ok = false; }
  bus.dispatchEvent(new Event("backend"));
  return B;
}
export const aiAvailable = () => (!!LS.get("invite") && B.meanings !== false) || !!LS.get("akey");

/* Claude meanings: the shared backend first, then a personal key if one is saved. */
export async function getAI(lrcId, uniq, meta){
  if(LS.get("invite") && lrcId && B.meanings !== false){
    try{ return await api("/meanings", { method:"POST", headers:{ "content-type":"application/json" },
      body:JSON.stringify({ lrclib_id:lrcId, title:meta.title, artist:meta.artist }) }); }
    catch(e){ LS.set("engineErr", e.message); if(!LS.get("akey")) throw e; }
  }
  if(LS.get("akey")) return await claudeDirect(uniq, meta);
  throw new Error("Claude isn't available");
}
