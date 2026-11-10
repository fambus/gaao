/* Local romanization for Gurmukhi (Punjabi) and Devanagari (Hindi, Haryanvi).
   Instant and offline, spelled the casual way people type lyrics: "mainu", "yaar", "mod", "paisa". */
export const SCRIPTS = {
  guru: {
    test: /[\u0A00-\u0A7F]/,
    indep: { "ਅ":"a","ਆ":"aa","ਇ":"i","ਈ":"ee","ਉ":"u","ਊ":"oo","ਏ":"e","ਐ":"ai","ਓ":"o","ਔ":"au" },
    carrier: { "ੳ":"u", "ੲ":"i" },
    cons: { "ਕ":"k","ਖ":"kh","ਗ":"g","ਘ":"gh","ਙ":"ng","ਚ":"ch","ਛ":"chh","ਜ":"j","ਝ":"jh","ਞ":"n","ਟ":"t","ਠ":"th","ਡ":"d","ਢ":"dh","ਣ":"n",
            "ਤ":"t","ਥ":"th","ਦ":"d","ਧ":"dh","ਨ":"n","ਪ":"p","ਫ":"ph","ਬ":"b","ਭ":"bh","ਮ":"m","ਯ":"y","ਰ":"r","ਲ":"l","ਵ":"v","ੜ":"d","ਸ":"s","ਹ":"h",
            "ਸ਼":"sh","ਖ਼":"kh","ਗ਼":"gh","ਜ਼":"z","ਫ਼":"f","ਲ਼":"l" },
    nukta: { "ਸ":"sh","ਖ":"kh","ਗ":"gh","ਜ":"z","ਫ":"f","ਲ":"l","ਕ":"q" },
    matra: { "ਾ":"aa","ਿ":"i","ੀ":"ee","ੁ":"u","ੂ":"oo","ੇ":"e","ੈ":"ai","ੋ":"o","ੌ":"au" },
    nasal: "ੰਂ", gem: "ੱ", virama: "੍", nuktaSign: "਼", visarga: "ਃ", skip: "ੑੵ",
    digits: "੦੧੨੩੪੫੬੭੮੯"
  },
  deva: {
    test: /[\u0900-\u097F]/,
    indep: { "अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au","ऑ":"o","ऍ":"e" },
    carrier: {},
    cons: { "क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"n","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"n","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n",
            "त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","ळ":"l","व":"v",
            "श":"sh","ष":"sh","स":"s","ह":"h" },
    nukta: { "क":"q","ख":"kh","ग":"gh","ज":"z","ड":"d","ढ":"dh","फ":"f","य":"y" },
    matra: { "ा":"aa","ि":"i","ी":"ee","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au","ॅ":"e","ॉ":"o" },
    nasal: "ंँ", gem: "", virama: "्", nuktaSign: "़", visarga: "ः", skip: "",
    digits: "०१२३४५६७८९"
  }
};
const DANDA = /[।॥]/g;
export function romanWord(word, S){
  const U = [];
  let gem = false;
  for(const ch of word){
    const last = U[U.length - 1];
    if(S.cons[ch]){ U.push({ c:S.cons[ch], base:ch, v:"A", gem }); gem = false; }
    else if(ch === S.nuktaSign){ if(last?.base && S.nukta[last.base]) last.c = S.nukta[last.base]; }
    else if(S.matra[ch]){ if(last && (last.v === "A" || last.carrier)) last.v = S.matra[ch]; else U.push({ c:"", v:S.matra[ch] }); }
    else if(ch === S.virama){ if(last) last.v = ""; }
    else if(S.indep[ch]){ U.push({ c:"", v:S.indep[ch] }); }
    else if(S.carrier[ch]){ U.push({ c:"", v:S.carrier[ch], carrier:true }); }
    else if(S.nasal.includes(ch)){ if(last) last.nasal = true; }
    else if(S.gem && ch === S.gem){ gem = true; }
    else if(ch === S.visarga){ if(last) last.post = "h"; }
    else if(S.digits.includes(ch)){ U.push({ c:String(S.digits.indexOf(ch)), v:"" }); }
    else if(S.skip.includes(ch)){ /* ignore */ }
    else U.push({ c:ch, v:"" });
  }
  // schwa deletion, right to left: drop the silent "a" the way the word is sung
  const n = U.length;
  for(let i = n - 1; i >= 0; i--){
    const u = U[i];
    if(u.v !== "A" || !u.c) continue;
    if(i === n - 1){ if(n > 1 && !u.nasal) u.v = ""; continue; }
    const prev = U[i - 1], next = U[i + 1];
    if(i > 0 && prev.v !== "" && !u.nasal && next?.c && next.v !== "") u.v = "";
  }
  // glide between vowels: kudi+e -> kudiye, pi+aar -> piyaar
  for(let i = 1; i < n; i++){
    const u = U[i], p = U[i - 1];
    if(!u.c && !u.carrier && ["a","aa","e"].includes(u.v) && ["ee","i"].includes(p.v)){ p.v = "i"; u.c = "y"; }
  }
  let out = "";
  U.forEach((u, i) => {
    const isLast = i === n - 1;
    let v = u.v === "A" ? "a" : u.v;
    if(isLast && u.c){ if(v === "aa") v = "a"; else if(v === "ee") v = "i"; else if(v === "oo") v = "u"; }
    if(u.gem && u.c) out += u.c[0];
    out += u.c + v;
    if(u.nasal){
      const nx = U[i + 1]?.c || "";
      if(isLast && u.c && (u.v === "oo" || u.v === "u")) {}               // mainu, tu
      else if(isLast && u.v === "e") out = out.slice(0, -1) + "ein";      // mein
      else out += /^[pbm]/.test(nx) ? "m" : "n";
    }
    if(u.post) out += u.post;
  });
  return out;
}
export function romanize(line){
  const S = SCRIPTS.guru.test.test(line) ? SCRIPTS.guru : SCRIPTS.deva.test.test(line) ? SCRIPTS.deva : null;
  if(!S) return line;
  const res = line.normalize("NFC").replace(DANDA, "").replace(/[\u0900-\u097F\u0A00-\u0A7F]+/g, w => romanWord(w, S)).replace(/\s+/g, " ").trim();
  return res.charAt(0).toUpperCase() + res.slice(1);
}
export const scriptLang = t => /[\u0A00-\u0A7F]/.test(t) ? "pa" : /[\u0900-\u097F]/.test(t) ? "hi" : /[\u0600-\u06FF]/.test(t) ? "ur" : "es";
