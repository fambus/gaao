import { LS, $ } from "../state.js";
import { listen } from "../sources/listen.js";
import { login } from "../sources/spotify.js";
import { openSetup } from "./settings.js";

/* ---------- welcome ---------- */
export function openWelcome(){
  $("welcome").hidden = false;
  $("wNote").textContent = LS.get("invite") ? "" : "Tip: Listen and Claude meanings switch on when you open Gaao from a share link.";
}
$("wListen").onclick = () => { LS.set("welcomed", "1"); $("welcome").hidden = true; listen(false); };
$("wSpotify").onclick = () => {
  LS.set("welcomed", "1"); $("welcome").hidden = true;
  if(LS.get("cid")) login(); else { openSetup(); $("ownApp").open = true; }
};
