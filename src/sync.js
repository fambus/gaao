import { LS, S, $ } from "./state.js";
import { LEAD_MS } from "./config.js";
import { listen, isListening } from "./sources/listen.js";

/* The clock: where we are in the song, which line that is, and the frame loop that lights it up. */
let userScrollUntil = 0;
export function holdAutoScroll(ms){ userScrollUntil = Date.now() + ms; }

export function posMs(){
  const off = +(LS.get("offset") || 0);
  const p = S.playing ? S.progress + (performance.now() - S.at) : S.progress;
  return p + LEAD_MS - off * 1000;
}
function currentIndex(){
  const p = posMs(), L = S.lines;
  let lo = 0, hi = L.length - 1, ans = -1;
  while(lo <= hi){ const mid = (lo + hi) >> 1; if(L[mid].t <= p){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
export function tick(){
  if(S.synced && S.lines.length){
    const i = currentIndex();
    if(i !== S.idx){
      $("ln" + S.idx)?.classList.remove("on");
      S.idx = i;
      const el = $("ln" + i);
      if(el){
        el.classList.add("on");
        if(Date.now() > userScrollUntil) el.scrollIntoView({ block:"center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
  }
  // Listen mode: when the song should have ended, listen again for the next one
  if(S.mode === "listen" && S.durationMs && !isListening() && !S.relisten && !document.hidden && posMs() > S.durationMs + 3000){
    S.relisten = true; listen(true);
  }
  requestAnimationFrame(tick);
}
