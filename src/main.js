import { LS, $ } from "./state.js";
import { readLinkParams } from "./links.js";
import { checkBackend } from "./meanings/backend.js";
import { handleCallback } from "./sources/spotify.js";
import { setMode } from "./mode.js";
import { tick } from "./sync.js";
import { idleMsg } from "./ui/render.js";
import { showOffset } from "./ui/controls.js";
import { openSetup } from "./ui/settings.js";
import { openWelcome } from "./ui/welcome.js";

/* ---------- boot ---------- */
(async () => {
  showOffset();
  try{ Object.keys(localStorage).filter(k => /^(v2:)?song:/.test(k)).forEach(k => localStorage.removeItem(k)); }catch{}
  readLinkParams();
  let cbErr = null;
  try{ await handleCallback(); }catch(e){ cbErr = e; }
  requestAnimationFrame(tick);
  checkBackend();
  if(cbErr){ openSetup(); $("setupErr").textContent = cbErr.message; return; }
  if(LS.get("rt")){ setMode("spotify"); return; }
  if(!LS.get("welcomed")) openWelcome(); else idleMsg();
})();
