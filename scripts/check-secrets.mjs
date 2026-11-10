// Fails if anything that looks like a secret is tracked by git. Runs in CI and before commits: npm run check:secrets
// It prints where a match is and which rule hit, never the matched text.
// A line that is a known false positive can carry the marker  secret-scan:allow  (say why next to it).
import { execSync } from "node:child_process";
import fs from "node:fs";

const RULES = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{16,}/],
  ["Supabase access token", /sbp_[a-f0-9]{30,}/],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["JWT (Supabase service/anon key or similar)", /eyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\./],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["Postgres URL with a password", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],
  ["32-character hex token (AudD token or Spotify client ID)", /(?<![0-9a-zA-Z])[0-9a-f]{32}(?![0-9a-zA-Z])/],
  // Invite codes: only the two test fixtures and obvious placeholders are allowed anywhere in the repo.
  ["Invite code in a link", /[?&]invite=(?!test-invite-1\b|share-code-1\b|<|\$|"|'|…|\s|$)[\w-]{6,64}/],
  ["Invite code in SQL", /\binvites\b[^;\n]*\bvalues\s*\(\s*'(?!PUT-|<)[^']{6,}'/i],
  ["Invite code in a header", /x-gaao-invite["']?\s*[:=]\s*["']?(?!test-invite-1\b|<|\$)[\w-]{6,64}/i],
  ["Hard-coded secret assignment", /\b(?:AUDD_API_TOKEN|ANTHROPIC_API_KEY|GENIUS_ACCESS_TOKEN|TURNSTILE_SECRET|GAAO_ADMIN_TOKEN|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN)\s*[=:]\s*["']?(?!your[-_]|<)[A-Za-z0-9_\-]{12,}/],
];
const ALLOW = /secret-scan:allow/;
const SKIP_FILES = /^(package-lock\.json|.*\.(png|jpg|jpeg|gif|ico|icns|woff2?))$/;
const FORBIDDEN_FILES = /(^|\/)(\.env(\.(?!example$)[^/]*)?|[^/]+\.env)$/;

// -z: NUL-separated and unquoted, so file names with non-ASCII characters are scanned too.
const tracked = execSync("git ls-files -z --cached --others --exclude-standard", { encoding: "utf8" }).split("\0").filter(Boolean);
let findings = 0, scanned = 0;
for (const file of tracked) {
  if (FORBIDDEN_FILES.test(file)) { console.error(`${file}: env files must not be committed`); findings++; continue; }
  if (SKIP_FILES.test(file)) continue;
  if (!fs.existsSync(file)) continue;                       // deleted in the working tree, not yet staged
  if (fs.statSync(file).size > 2_000_000) { console.error(`${file}: too large to scan (over 2 MB)`); findings++; continue; }
  scanned++;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (ALLOW.test(line)) return;
    for (const [name, re] of RULES) if (re.test(line)) { console.error(`${file}:${i + 1}: looks like a ${name}`); findings++; }
  });
}
if (findings) { console.error(`\n${findings} possible secret(s). Remove them (and rotate the key if it was ever pushed).`); process.exit(1); }
console.log(`No secrets found in ${scanned} files.`);
