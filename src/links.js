import { LS } from "./state.js";
import { BASE } from "./config.js";

/* ---------- share links: ?invite=…&cid=… ---------- */
export function extractCid(raw){
  const text = String(raw || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  const m = text.match(/(?<![0-9a-z])[0-9a-f]{32}(?![0-9a-z])/i);
  if(m) return m[0].toLowerCase();
  const flat = text.replace(/\s/g, "");
  return /^[0-9a-f]{32}$/i.test(flat) ? flat.toLowerCase() : "";
}
export function readLinkParams(){
  const q = new URLSearchParams(location.search);
  const inv = q.get("invite"), cid = extractCid(q.get("cid") || "");
  if(inv && /^[\w-]{6,64}$/.test(inv)) LS.set("invite", inv);
  if(cid) LS.set("cid", cid);
}
export function linkFor(invite){
  const p = new URLSearchParams();
  if(invite) p.set("invite", invite);
  if(LS.get("cid")) p.set("cid", LS.get("cid"));
  const s = p.toString();
  return BASE + (s ? "?" + s : "");
}
