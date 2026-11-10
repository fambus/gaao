// Fails if anything that looks like a secret is tracked by git. Runs in CI and before commits: npm run check:secrets
// It prints where a match is and which rule hit, never the matched text.
import { execSync } from "node:child_process";
import fs from "node:fs";

const RULES = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{16,}/],
  ["Supabase access token", /sbp_[a-f0-9]{30,}/],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["JWT (Supabase service/anon key or similar)", /eyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\./],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["Postgres URL with a password", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],
  ["32-character hex token (AudD token or Spotify client ID)", /(?<![0-9a-zA-Z])[0-9a-f]{32}(?![0-9a-zA-Z])/],
  ["Invite code in a link", /[?&]invite=(?!test-|share-code-|<|\$|"|'|…|\s|$)[\w-]{6,64}/],
  ["Hard-coded secret assignment", /\b(?:AUDD_API_TOKEN|ANTHROPIC_API_KEY|GENIUS_ACCESS_TOKEN|TURNSTILE_SECRET|GAAO_ADMIN_TOKEN|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*["']?[A-Za-z0-9_\-]{12,}/],
];
const SKIP_FILES = /^(package-lock\.json|docs\/.*\.(png|jpg|gif)|public\/.*\.(png|ico|woff2?))$/;
const FORBIDDEN_FILES = /(^|\/)\.env(\.(?!example$)[^/]*)?$/;

const tracked = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
let findings = 0;
for (const file of tracked) {
  if (FORBIDDEN_FILES.test(file)) { console.error(`${file}: env files must not be committed`); findings++; continue; }
  if (SKIP_FILES.test(file) || !fs.existsSync(file) || fs.statSync(file).size > 2_000_000) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [name, re] of RULES) if (re.test(line)) { console.error(`${file}:${i + 1}: looks like a ${name}`); findings++; }
  });
}
if (findings) { console.error(`\n${findings} possible secret(s). Remove them (and rotate the key if it was ever pushed).`); process.exit(1); }
console.log(`No secrets found in ${tracked.length} files.`);
