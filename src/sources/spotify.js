import { LS, S, B } from "../state.js";
import { REDIRECT, SCOPES } from "../config.js";
import { linkFor } from "../links.js";
import { api } from "../meanings/backend.js";
import { findLyrics } from "../lyrics/lrclib.js";
import { loadTrack } from "../track.js";
import { setChip, showMsg } from "../ui/render.js";
import { setMode, registerMode } from "../mode.js";

/* ---------- Spotify auth (PKCE, no server needed) ---------- */
function rand(n){ const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,"0")).join(""); }
async function challenge(v){
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
export async function login(){
  const v = rand(48), s = rand(8);
  LS.set("pkce_v", v); LS.set("pkce_s", s);
  const p = new URLSearchParams({ client_id:LS.get("cid"), response_type:"code", redirect_uri:REDIRECT, scope:SCOPES,
    code_challenge_method:"S256", code_challenge: await challenge(v), state:s });
  location.href = "https://accounts.spotify.com/authorize?" + p;
}
function saveTokens(j){
  if(!j.access_token) throw new Error(j.error_description || j.error || "Spotify did not return a token");
  LS.set("at", j.access_token);
  LS.set("exp", String(Date.now() + (j.expires_in - 60) * 1000));
  if(j.refresh_token) LS.set("rt", j.refresh_token);
}
async function tokenRequest(body){
  const r = await fetch("https://accounts.spotify.com/api/token", { method:"POST",
    headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:new URLSearchParams(body) });
  const j = await r.json().catch(() => ({}));
  if(!r.ok){ const e = new Error(j.error_description || j.error || ("Spotify login failed (" + r.status + ")")); e.status = r.status; throw e; }
  return j;
}
export async function handleCallback(){
  const q = new URLSearchParams(location.search);
  if(!q.has("code") && !q.has("error")) return;
  history.replaceState(null, "", linkFor(LS.get("invite")));   // keep the invite in the address, so Add to Home Screen keeps it
  if(q.get("error")) throw new Error("Spotify said: " + q.get("error") + ".");
  if(q.get("state") !== LS.get("pkce_s")) throw new Error("Login check failed. Tap Connect Spotify again.");
  saveTokens(await tokenRequest({ grant_type:"authorization_code", code:q.get("code"), redirect_uri:REDIRECT,
    client_id:LS.get("cid"), code_verifier:LS.get("pkce_v") }));
  LS.del("pkce_v"); LS.del("pkce_s");
}
let refreshing = null;
async function token(){
  if(LS.get("at") && Date.now() < +LS.get("exp")) return LS.get("at");
  if(!LS.get("rt")) throw Object.assign(new Error("Not logged in"), { auth:true });
  refreshing ??= tokenRequest({ grant_type:"refresh_token", refresh_token:LS.get("rt"), client_id:LS.get("cid") })
    .then(saveTokens)
    .catch(e => { if(e.status === 400){ LS.del("at"); LS.del("rt"); e.auth = true; } throw e; })
    .finally(() => { refreshing = null; });
  await refreshing;
  return LS.get("at");
}

/* ---------- follow what's playing ---------- */
let pollTimer = null, backoffUntil = 0;

export async function poll(){
  clearTimeout(pollTimer);
  if(S.mode !== "spotify") return;
  let next = document.hidden ? 15000 : 2500;
  try{
    if(Date.now() < backoffUntil){ next = backoffUntil - Date.now(); return; }
    const t = await token();
    const t0 = performance.now();
    const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers:{ Authorization:"Bearer " + t } });
    const t1 = performance.now();
    if(S.mode !== "spotify") return;
    if(r.status === 204){ setChip("Idle"); S.playing = false; if(!S.id) showMsg("Play something on Spotify", "Or tap Listen to catch a song playing nearby."); return; }
    if(r.status === 401){ LS.del("at"); next = 500; return; }
    if(r.status === 429){ backoffUntil = Date.now() + 15000; setChip("Slow down", "err"); return; }
    if(r.status === 403){
      setChip("Not approved", "err");
      showMsg("Spotify hasn't approved this account yet", "Ask the person who shared Gaao to add your Spotify email in their Spotify app's User Management. Meanwhile, Listen works without Spotify.");
      next = 30000; return;
    }
    if(!r.ok){ setChip("Error " + r.status, "err"); return; }
    const j = await r.json();
    S.progress = j.progress_ms || 0;
    S.at = t0 + (t1 - t0) / 2;
    S.playing = !!j.is_playing;
    const item = j.item;
    if(!item){ setChip("Idle"); return; }
    if(item.id !== S.id) loadTrack(item).then(() => setTimeout(prefetchNext, 4000));
    else setChip(S.playing ? (S.synced ? "Live" : "Unsynced") : "Paused", S.playing && S.synced ? "live" : "");
  }catch(e){
    if(e.auth){ setMode("idle"); showMsg("Spotify logged out", "Open ⚙︎ to connect again, or tap Listen."); return; }
    setChip("Offline", "err"); next = 5000;
  }finally{
    if(S.mode === "spotify") pollTimer = setTimeout(poll, next);
  }
}

/* Warm the shared cache for the next songs in your Spotify queue, so their meanings are ready on time. */
const prefetched = new Set();
async function prefetchNext(){
  if(S.mode !== "spotify" || !LS.get("invite") || !B.meanings) return;
  try{
    const r = await fetch("https://api.spotify.com/v1/me/player/queue", { headers:{ Authorization:"Bearer " + await token() } });
    if(!r.ok) return;
    const q = await r.json();
    for(const it of (q.queue || []).slice(0, 2)){
      if(!it?.id || prefetched.has(it.id) || LS.get("v3:song:" + it.id)) continue;
      prefetched.add(it.id);
      const found = await findLyrics(it);
      if(found?.id && (found.syncedLyrics || found.plainLyrics))
        api("/meanings", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ lrclib_id:found.id }) }).catch(() => {});
    }
  }catch{}
}

registerMode("spotify", { start(){ S.id = null; poll(); }, stop(){ clearTimeout(pollTimer); } });
