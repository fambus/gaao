/* Shared state: storage wrapper, playback state, backend status, and a tiny event bus. */
const mem = {};
export const LS = {
  get(k){ try{ const v = localStorage.getItem(k); return v ?? mem[k] ?? null; }catch{ return mem[k] ?? null; } },
  set(k,v){ mem[k]=v; try{ localStorage.setItem(k,v); }catch{} },
  del(k){ delete mem[k]; try{ localStorage.removeItem(k); }catch{} }
};
export const $ = id => document.getElementById(id);

// Backend status from /health. null = not checked yet.
export const B = { ok:false, invite:null, listen:null, meanings:null, share_code:null };

// Playback and lyrics state for the song on screen.
export const S = { mode:"idle", id:null, progress:0, at:0, playing:false, lines:[], synced:false, idx:-1, gen:0, durationMs:0, relisten:false, about:null };

export const bus = new EventTarget();   // "backend" fires after every /health check
