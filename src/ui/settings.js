import { LS, S, B, $, bus } from "../state.js";
import { REDIRECT } from "../config.js";
import { extractCid, linkFor } from "../links.js";
import { checkBackend } from "../meanings/backend.js";
import { claudeDirect } from "../meanings/direct.js";
import { ENGINES, blocked } from "../meanings/free.js";
import { romanize } from "../roman/local.js";
import { captureClip } from "../sources/listen.js";
import { login } from "../sources/spotify.js";
import { setMode } from "../mode.js";
import { idleMsg } from "./render.js";
import { wantWake, getWake, releaseWake } from "./controls.js";

/* ---------- settings ---------- */
export function renderStatus(){
  const ul = $("status"); if(!ul) return;
  const rows = [];
  const row = (state, text) => rows.push([state, text]);
  if(!LS.get("invite")) row("n", "No invite. Open Gaao from a share link to switch on Listen and Claude meanings.");
  else if(!B.ok) row("w", "Checking Gaao's server…");
  else if(!B.invite) row("n", "This invite isn't valid any more. Ask for a fresh link.");
  else {
    row(B.listen ? "y" : "n", B.listen ? "Listen is on" : "Listen is waiting for its recognition key");
    row(B.meanings ? "y" : "n", B.meanings ? "Claude meanings are on, shared with everyone using this Gaao" : "Claude meanings are waiting for their API key");
  }
  if(LS.get("akey")) row("y", "Your own Anthropic key is saved on this phone");
  row(LS.get("rt") ? "y" : "w", LS.get("rt") ? "Spotify connected" : "Spotify not connected (optional)");
  ul.replaceChildren(...rows.map(([s, t]) => {
    const li = document.createElement("li");
    const i = document.createElement("span"); i.className = "s " + s; i.textContent = s === "y" ? "✓" : s === "n" ? "✕" : "·";
    li.append(i, document.createTextNode(t)); return li;
  }));
  const share = B.invite && (B.share_code || LS.get("invite"));
  $("shareBox").hidden = !share;
  if(share) $("shareLink").textContent = linkFor(B.share_code || LS.get("invite"));
}
export function openSetup(){
  $("setup").hidden = false;
  $("redir").textContent = REDIRECT;
  $("cid").value = LS.get("cid") || "";
  checkCid();
  $("akey").value = LS.get("akey") || "";
  $("wakeChk").checked = wantWake();
  $("origChk").checked = LS.get("orig") === "1";
  const authed = !!LS.get("rt");
  $("spotState").textContent = authed ? "Connected. Gaao follows what you play."
    : LS.get("cid") ? "Follows what you play on Spotify on this phone, in perfect sync." : "Needs a Spotify app. A share link sets this up for you.";
  $("connect").textContent = authed ? "Reconnect Spotify" : "Connect Spotify";
  $("logout").hidden = !authed;
  renderStatus(); checkBackend();
}
function closeSetup(){
  checkCid();
  const akey = $("akey").value.trim();
  if(akey) LS.set("akey", akey); else LS.del("akey");
  $("setup").hidden = true;
}
function checkCid(){
  const raw = $("cid").value, id = extractCid(raw), hint = $("cidHint");
  if(id){
    if(raw !== id) $("cid").value = id;
    LS.set("cid", id);
    hint.textContent = "✓ Looks right"; hint.className = "note good";
  } else if(raw.trim()){
    const shown = raw.trim().replace(/[\u200B-\u200D\u2060\uFEFF]/g, "·");
    hint.textContent = "Got " + raw.trim().length + " characters: \"" + shown.slice(0, 40) + (shown.length > 40 ? "…" : "") + "\". A Client ID is exactly 32 characters, digits and a–f only.";
    hint.className = "note bad";
  } else { hint.textContent = ""; hint.className = "note"; }
  return id;
}
["input", "change", "blur"].forEach(ev => $("cid").addEventListener(ev, checkCid));
$("cid").addEventListener("paste", e => {
  const text = e.clipboardData?.getData("text");
  if(text == null) return;
  e.preventDefault(); $("cid").value = text; checkCid();
});
$("pasteCid").onclick = async () => {
  try{ $("cid").value = await navigator.clipboard.readText(); checkCid(); }
  catch{ $("cid").focus(); $("cidHint").textContent = "Long-press the box and choose Paste."; $("cidHint").className = "note"; }
};
$("gear").onclick = openSetup;
$("closeSetup").onclick = () => { closeSetup(); if(!S.lines.length && S.mode !== "spotify") idleMsg(); };
$("copyRedir").onclick = async e => {
  try{ await navigator.clipboard.writeText(REDIRECT); e.currentTarget.textContent = "Copied"; }
  catch{ const r = document.createRange(); r.selectNodeContents($("redir")); getSelection().removeAllRanges(); getSelection().addRange(r); }
};
$("connect").onclick = () => {
  if(!checkCid()){ $("ownApp").open = true; $("setupErr").textContent = "Add a Spotify Client ID first, under Use your own Spotify app."; $("cid").focus(); return; }
  closeSetup(); login();
};
$("logout").onclick = () => { ["at","rt","exp"].forEach(LS.del); setMode("idle"); openSetup(); };
$("origChk").onchange = e => { LS.set("orig", e.target.checked ? "1" : "0"); $("stage").classList.toggle("orig", e.target.checked); };
$("wakeChk").onchange = e => { LS.set("wake", e.target.checked ? "1" : "0"); if(e.target.checked) getWake(); else releaseWake(); };
$("shareBtn").onclick = async e => {
  const url = $("shareLink").textContent;
  const text = "Gaao: sing along to any song, in any language. Open this, tap Listen near the music.";
  try{ if(navigator.share){ await navigator.share({ title:"Gaao", text, url }); return; } }catch(err){ if(err.name === "AbortError") return; }
  try{ await navigator.clipboard.writeText(url); e.currentTarget.textContent = "Link copied"; }
  catch{ const r = document.createRange(); r.selectNodeContents($("shareLink")); getSelection().removeAllRanges(); getSelection().addRange(r); }
};
$("clearCache").onclick = e => {
  try{ Object.keys(localStorage).filter(k => /^(v\d:)?song:/.test(k)).forEach(k => localStorage.removeItem(k)); }catch{}
  e.currentTarget.textContent = "Cleared"; S.id = null;
};
$("micBtn").onclick = async () => {
  const box = $("diag"); box.textContent = "Recording 3 seconds…";
  let stream;
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
    const c = await captureClip(stream, 3000);
    box.textContent = (c.bytes > 1000 ? "✓ Microphone works: " : "✕ Recording was empty: ") + Math.round(c.bytes / 1024) + " KB as " + c.name +
      "\nListen is " + (B.listen ? "on" : B.ok ? "off on the server (recognition key missing)" : "unknown (server not checked)") + ".";
  }catch(e){ box.textContent = "✕ Microphone: " + (e.name === "NotAllowedError" ? "blocked. In Safari tap aA, then Website Settings, and set Microphone to Allow." : (e.name || "") + " " + (e.message || "")); }
  finally{ stream?.getTracks().forEach(t => t.stop()); }
};
$("testBtn").onclick = async () => {
  const box = $("diag"), out = []; box.textContent = "Testing…";
  const akey = $("akey").value.trim(); if(akey) LS.set("akey", akey);
  await checkBackend();
  out.push(B.ok ? "✓ Gaao server reachable. Invite " + (B.invite ? "valid" : "not valid") + ", Listen " + (B.listen ? "on" : "off") + ", Claude " + (B.meanings ? "on" : "off") + "."
                : "✕ Gaao server not reachable");
  const sample = "ਮੈਨੂ ਮੇਰੇ ਯਾਰ ਮੋੜ ਦੋ";
  out.push("Romanized on this phone: " + romanize(sample));
  if(LS.get("akey")){
    try{ const r = await claudeDirect([sample], { title:"Yaar Mod Do", artist:"Guru Randhawa" }); out.push("✓ Your Claude key: " + r.lines[0].r + " → " + r.lines[0].m); }
    catch(e){ out.push("✕ Your Claude key: " + e.message); }
  }
  for(const [name, fn] of Object.entries(ENGINES)){
    try{ out.push("✓ " + name + ": " + await fn(sample)); }
    catch(e){ out.push("✕ " + name + ": " + blocked(e)); }
  }
  box.textContent = out.join("\n");
};

bus.addEventListener("backend", renderStatus);
