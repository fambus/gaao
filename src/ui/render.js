import { LS, S, $ } from "../state.js";

/* ---------- rendering ---------- */
let toastTimer = null;
export function showMsg(head, body){
  const st = $("stage"); st.replaceChildren(); st.classList.remove("unsynced");
  const d = document.createElement("div"); d.className = "msg";
  const s = document.createElement("strong"); s.textContent = head;
  d.append(s, document.createTextNode(body || ""));
  st.append(d);
}
export function toast(text){
  const t = $("toast"); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5500);
}
export function setAbout(){
  const a = $("about"); if(!a) return;
  a.replaceChildren();
  if(!S.about?.summary){ a.hidden = true; return; }
  const l = document.createElement("span"); l.className = "lang";
  l.textContent = (S.about.language ? S.about.language + " · " : "") + "What it's about";
  a.append(l, document.createTextNode(S.about.summary));
  a.hidden = false;
}
export function render(){
  const st = $("stage"); st.replaceChildren();
  st.classList.toggle("unsynced", !S.synced);
  const about = document.createElement("div"); about.className = "about"; about.id = "about";
  st.append(about); setAbout();
  S.lines.forEach((l, i) => {
    const el = document.createElement("div");
    el.className = "ln" + (l.text ? "" : " gap"); el.id = "ln" + i;
    const r = document.createElement("div"); r.className = "r";
    const o = document.createElement("div"); o.className = "o";
    const m = document.createElement("div"); m.className = "m";
    el.append(r, o, m); st.append(el);
    paintLine(i);
  });
  S.idx = -1;
  st.scrollTop = 0;
}
export function paintLine(i){
  const el = $("ln" + i); if(!el) return;
  const l = S.lines[i];
  const [r, o, m] = el.children;
  if(!l.text){ r.textContent = "♪"; o.textContent = ""; m.textContent = ""; m.hidden = true; return; }
  r.textContent = l.r || l.text;
  o.textContent = l.r && l.r !== l.text ? l.text : "";
  m.textContent = l.m === undefined ? "" : (l.m && l.m.toLowerCase() !== (l.r || l.text).toLowerCase() ? l.m : " ");
  m.hidden = false;
}
export function setChip(text, cls = ""){ const c = $("chip"); c.textContent = text; c.className = "chip" + (cls ? " " + cls : ""); }
export function idleMsg(){
  showMsg(LS.get("invite") ? "Hear a song? Tap Listen." : "Open your invite link",
    LS.get("invite") ? "Lyrics in English letters, with what each line means, in time with the music."
                     : "Gaao's listening and Claude meanings switch on when you open it from a share link.");
}
