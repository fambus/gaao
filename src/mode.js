import { S, LS, $ } from "./state.js";

/* Where the song comes from: "idle", "spotify", "listen" (more sources register themselves here). */
const modes = {};
export function registerMode(name, hooks){ modes[name] = hooks; }
export function setMode(m){
  S.mode = m;
  for(const h of Object.values(modes)) h.stop?.();
  $("spotBtn").hidden = !(m !== "spotify" && LS.get("rt"));
  modes[m]?.start?.();
}
