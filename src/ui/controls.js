import { LS, S, $ } from "../state.js";
import { holdAutoScroll } from "../sync.js";
import { listen } from "../sources/listen.js";
import { poll } from "../sources/spotify.js";
import { setMode } from "../mode.js";

/* ---------- controls ---------- */
export function showOffset(){ const v = +(LS.get("offset") || 0); $("offv").textContent = (v > 0 ? "+" : "") + v.toFixed(1) + "s"; }
function nudge(d){ const v = Math.round((+(LS.get("offset") || 0) + d) * 10) / 10; LS.set("offset", String(v)); showOffset(); S.idx = -2; }
$("minus").onclick = () => nudge(-0.5);
$("plus").onclick = () => nudge(0.5);
$("stage").classList.toggle("orig", LS.get("orig") === "1");
$("listenBtn").onclick = () => listen(false);
$("spotBtn").onclick = () => setMode("spotify");
["touchstart", "wheel"].forEach(ev => $("stage").addEventListener(ev, () => { holdAutoScroll(4000); }, { passive:true }));

let wake = null;
export const wantWake = () => LS.get("wake") !== "0";
export async function getWake(){ if(!wantWake() || wake || document.hidden) return; try{ wake = await navigator.wakeLock?.request("screen"); wake?.addEventListener("release", () => { wake = null; }); }catch{ wake = null; } }
document.addEventListener("pointerdown", getWake, { passive:true });
document.addEventListener("visibilitychange", () => { if(!document.hidden){ getWake(); if(S.mode === "spotify") poll(); } });
export function releaseWake(){ try{ wake?.release(); }catch{} wake = null; }
