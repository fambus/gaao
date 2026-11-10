export function parseLRC(s){
  const out = [];
  for(const raw of s.split(/\r?\n/)){
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if(!tags.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for(const m of tags) out.push({ t:(+m[1] * 60 + +m[2]) * 1000, text });
  }
  return out.sort((a,b) => a.t - b.t);
}
