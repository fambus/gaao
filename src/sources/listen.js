import { LS, S, B, $ } from "../state.js";
import { CLIP_MS } from "../config.js";
import { api, checkBackend } from "../meanings/backend.js";
import { loadTrack } from "../track.js";
import { setChip, showMsg, toast } from "../ui/render.js";
import { setMode } from "../mode.js";

/* ---------- Listen: identify music playing nearby ---------- */
let listening = false, audioCtx = null;
export const isListening = () => listening;
function setLevel(v){ $("listenBtn").style.setProperty("--lvl", v.toFixed(2)); }
function setListenUI(on){ $("listenBtn").classList.toggle("rec", on); $("listenTxt").textContent = on ? "Listening" : "Listen"; if(!on) setLevel(0); }

// iOS only starts audio inside a tap, so create and resume the context before any await in the tap handler.
function unlockAudio(){
  const AC = window.AudioContext || window.webkitAudioContext;
  try{ audioCtx ??= new AC(); audioCtx.resume().catch(() => {}); }catch{}
}
async function recordClip(stream, ms){
  if(!audioCtx) unlockAudio();
  try{ await audioCtx.resume(); }catch{}
  const ctx = audioCtx;
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = []; let startedAt = null, sumSq = 0, count = 0;
  proc.onaudioprocess = e => {
    const d = e.inputBuffer.getChannelData(0);
    if(startedAt === null) startedAt = performance.now() - e.inputBuffer.duration * 1000;
    chunks.push(new Float32Array(d));
    let s = 0; for(let i = 0; i < d.length; i++) s += d[i] * d[i];
    sumSq += s; count += d.length;
    setLevel(Math.min(1, Math.sqrt(s / d.length) * 8));
  };
  src.connect(proc); proc.connect(ctx.destination);   // output stays silent; Safari only runs the processor when connected
  await new Promise(r => setTimeout(r, ms));
  proc.onaudioprocess = null;
  try{ proc.disconnect(); src.disconnect(); }catch{}
  setLevel(0);
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const all = new Float32Array(total);
  let o = 0; for(const c of chunks){ all.set(c, o); o += c.length; }
  return { blob: wavBlob(downsample(all, ctx.sampleRate, 16000), 16000), startedAt: startedAt ?? performance.now() - ms,
           rms: count ? Math.sqrt(sumSq / count) : 0, samples: total };
}
// iPhone Safari records reliably with MediaRecorder (AAC in .m4a); Web Audio capture can come back silent there.
function pickRecorderType(){
  if(!window.MediaRecorder) return null;
  for(const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"])
    try{ if(MediaRecorder.isTypeSupported(t)) return t; }catch{}
  return "";
}
function recordWithRecorder(stream, ms, type, onTick){
  return new Promise((resolve, reject) => {
    let rec;
    try{ rec = type ? new MediaRecorder(stream, { mimeType:type }) : new MediaRecorder(stream); }
    catch(e){ reject(e); return; }
    const parts = []; let startedAt = null, timer = null, tickT = null;
    rec.ondataavailable = e => { if(e.data && e.data.size) parts.push(e.data); };
    rec.onerror = e => { clearTimeout(timer); clearInterval(tickT); reject(e.error || new Error("Recorder error")); };
    rec.onstart = () => {
      startedAt = performance.now();
      let left = Math.round(ms / 1000); onTick?.(left);
      tickT = setInterval(() => onTick?.(--left), 1000);
      timer = setTimeout(() => { try{ rec.stop(); }catch{} }, ms);
    };
    rec.onstop = () => {
      clearInterval(tickT);
      const mime = (rec.mimeType || type || "audio/mp4").split(";")[0];
      const blob = new Blob(parts, { type:mime });
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "audio";
      resolve({ blob, name:"clip." + ext, startedAt: startedAt ?? performance.now() - ms, bytes: blob.size });
    };
    rec.start(1000);
  });
}
export async function captureClip(stream, ms, onTick){
  const type = pickRecorderType();
  if(type !== null) return recordWithRecorder(stream, ms, type, onTick);
  unlockAudio();
  const c = await recordClip(stream, ms);
  return { blob:c.blob, name:"clip.wav", startedAt:c.startedAt, bytes:c.blob.size };
}
function downsample(buf, from, to){
  if(from <= to) return buf;
  const ratio = from / to, len = Math.floor(buf.length / ratio), out = new Float32Array(len);
  for(let i = 0; i < len; i++){
    const a = Math.floor(i * ratio), b = Math.min(buf.length, Math.floor((i + 1) * ratio));
    let s = 0; for(let j = a; j < b; j++) s += buf[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}
function wavBlob(samples, rate){
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const w = (o, s) => { for(let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples.length * 2, true);
  let peak = 0; for(let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const g = peak > 0 && peak < 0.5 ? Math.min(8, 0.9 / peak) : 1;          // lift quiet rooms a little
  for(let i = 0; i < samples.length; i++){
    const s = Math.max(-1, Math.min(1, samples[i] * g));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type:"audio/wav" });
}
function artistsOf(str){
  return String(str || "").split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b)\s*/i).filter(Boolean).map(name => ({ name }));
}
function listenErrorText(e){
  if(e.code === "invite") return ["Invite link not valid", "Ask for a fresh Gaao link and open it on this phone."];
  if(e.code === "limit") return ["Daily limit reached", e.message];
  if(e.code === "not_configured") return ["Listening isn't on yet", "The person who runs this Gaao still needs to add the recognition key."];
  if(e.code === "network") return ["You're offline", e.message];
  return [e.ui || "Couldn't listen", e.message];
}

function listenStop(head, body){ setChip(head, "err"); if(S.lines.length) toast(body); else showMsg(head, body); }
export async function listen(auto = false){
  if(listening) return;
  if(!window.MediaRecorder) unlockAudio();   // old browsers only: Web Audio must start inside the tap
  if(!LS.get("invite")){
    listenStop("No invite", "Open Gaao from your invite link once on this phone. That switches on listening and Claude meanings.");
    return;
  }
  if(!B.ok) await checkBackend();
  if(B.ok && B.invite === false){ listenStop("Invite not valid", "Ask for a fresh Gaao link and open it on this phone."); return; }
  if(B.ok && B.listen === false){ listenStop("Listen is off", "The recognition key hasn't been added to Gaao's server yet. Once it is, Listen works straight away."); return; }
  setMode("listen");
  listening = true; setListenUI(true);
  if(!S.lines.length) showMsg("Listening…", "Hold your phone near the music for a few seconds.");
  setChip("Listening");
  let stream = null;
  try{
    for(let attempt = 1; attempt <= (auto ? 1 : 2); attempt++){
      try{
        stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
      }catch(e){
        throw Object.assign(new Error(e.name === "NotAllowedError"
          ? "Gaao needs the microphone to hear the song. In Safari, tap aA in the address bar, then Website Settings, and set Microphone to Allow."
          : "Couldn't open the microphone (" + e.name + ")."), { ui:"Microphone is off" });
      }
      let clip;
      try{ clip = await captureClip(stream, CLIP_MS, n => { if(n > 0) $("listenTxt").textContent = "Listening " + n; }); }
      catch(e){ throw Object.assign(new Error("The microphone stopped unexpectedly (" + (e.name || e.message) + "). Tap Listen to try again."), { ui:"Recording failed" }); }
      stream.getTracks().forEach(t => t.stop()); stream = null;
      $("listenTxt").textContent = "Identifying";
      if(clip.bytes < 1000) throw Object.assign(new Error("The recording came back empty. Tap Listen to try again; if it keeps happening, open ⚙︎ and tap Test microphone."), { ui:"Empty recording" });
      setChip("Identifying");
      const fd = new FormData(); fd.append("file", clip.blob, clip.name);
      const res = await api("/recognize", { method:"POST", body:fd });
      if(!res.match){
        if(attempt < (auto ? 1 : 2)){ setChip("Listening again"); continue; }
        throw Object.assign(new Error(auto ? "Song over? Tap Listen when the next one starts."
          : "Couldn't recognise this one. Try closer to the speaker, ideally while someone is singing."), { ui:"No match" });
      }
      // timecode is where in the song the clip started; carry it forward to now
      const item = {
        id: res.spotify_id || ("heard:" + (res.title + "|" + res.artist).toLowerCase()),
        name: res.title, artists: artistsOf(res.artist),
        album: { name: res.album || "", images: res.art ? [{ url:res.art }] : [] },
        duration_ms: res.duration_ms || 0
      };
      S.progress = res.timecode_ms + (performance.now() - clip.startedAt);
      S.at = performance.now(); S.playing = true;
      S.durationMs = res.duration_ms || 0; S.relisten = false;
      if(item.id !== S.id) loadTrack(item);
      else { S.idx = -2; setChip("Re-synced", "live"); toast("Back in sync with " + res.title + "."); }
      return;
    }
  }catch(e){
    const [head, body] = listenErrorText(e);
    setChip(head, "err");
    if(S.lines.length) toast(body); else showMsg(head, body);
  }finally{
    if(stream) stream.getTracks().forEach(t => t.stop());
    listening = false; setListenUI(false);
  }
}
