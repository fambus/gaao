/* App-wide constants. */
export const BACKEND = "https://oqznbxiibpiocvwoqexj.supabase.co/functions/v1/gaao";
export const AI_MODEL = "claude-sonnet-5-5";   // used only with a personal API key
export const LEAD_MS = 250;                     // show each line a touch early so you can start singing
export const CLIP_MS = 8000;                    // how long Listen records

export const BASE = location.origin + location.pathname.replace(/index\.html$/, "");
export const REDIRECT = BASE;
export const SCOPES = "user-read-currently-playing user-read-playback-state";
