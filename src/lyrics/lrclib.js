/* Lyrics from LRCLIB (free, no key). */
export function cleanTitle(s){
  return s.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, "").replace(/\s+-\s+.*$/, "").trim() || s;
}
async function lrclib(params){
  const r = await fetch("https://lrclib.net/api/" + params, { headers:{ "Lrclib-Client":"Gaao web" } }).catch(() => null);
  if(!r || !r.ok) return null;
  return r.json().catch(() => null);
}
export async function findLyrics(item){
  const title = item.name, artist = (item.artists || [])[0]?.name || "", album = item.album?.name || "";
  const dur = Math.round((item.duration_ms || 0) / 1000);
  if(dur){
    const exact = await lrclib("get?" + new URLSearchParams({ track_name:title, artist_name:artist, album_name:album, duration:dur }));
    if(exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) return exact;
  }
  const ct = cleanTitle(title);
  const tries = [{ track_name:ct, artist_name:artist }, { q:ct + " " + artist }, { q:ct }];
  for(const t of tries){
    const arr = await lrclib("search?" + new URLSearchParams(t));
    if(!Array.isArray(arr) || !arr.length) continue;
    const scored = arr.filter(x => x.syncedLyrics || x.plainLyrics).map(x => ({ x, d: dur ? Math.abs((x.duration || 0) - dur) : 0 }));
    const synced = scored.filter(s => s.x.syncedLyrics && s.d <= 6).sort((a,b) => a.d - b.d);
    if(synced.length) return synced[0].x;
    const plain = scored.sort((a,b) => a.d - b.d);
    if(plain.length && plain[0].d <= 15) return plain[0].x;
  }
  return null;
}
