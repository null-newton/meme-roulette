// One-shot setup for the Meme Roulette stats Worker (Cloudflare free plan, no card needed). Asks nothing.
// Run from the repo root: npm run setup:worker   (or: node cloudflare/setup.mjs)
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.dirname(DIR);
const TOML = path.join(DIR, 'wrangler.toml'), ENV = path.join(ROOT, 'public', 'env.js'), TOKEN_FILE = path.join(DIR, 'summary-token.txt');
const SITE = 'https://meme.zacsvae.com', WRANGLER = 'wrangler@4';
const c = { b: s => `\x1b[1m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` };
const step = s => console.log('\n' + c.b('▸ ' + s)), ok = s => console.log(c.g('  ✓ ' + s)), die = s => { console.error(c.r('\n✗ ' + s)); process.exit(1); };
const LOGGED_IN = /You are logged in|associated with the email/i;

// Runs wrangler via npx; interactive=true hands the terminal over (for login)
function wrangler(args, interactive = false) {
  const r = spawnSync('npx', ['--yes', WRANGLER, ...args], { cwd: DIR, shell: true, encoding: 'utf8', stdio: interactive ? 'inherit' : 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' } });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}

console.log(c.b('\nMeme Roulette — stats Worker setup'));
console.log(c.d('Deploys cloudflare/worker.js on the Cloudflare free plan: anonymous card stats (/stats, /summary).'));

step('Signing in to Cloudflare');
if (!LOGGED_IN.test(wrangler(['whoami']).out)) {
  console.log('  A browser window will open; approve access there.');
  if (wrangler(['login'], true).code !== 0) die('Cloudflare login failed.');
}
if (!LOGGED_IN.test(wrangler(['whoami']).out)) die('Still not logged in to Cloudflare.');
ok('Logged in');

step('Creating the stats storage (KV namespace)');
let toml = fs.readFileSync(TOML, 'utf8');
if (toml.includes('REPLACE_WITH_KV_NAMESPACE_ID')) {
  const r = wrangler(['kv', 'namespace', 'create', 'STATS']); let id = (r.out.match(/"?id"?\s*[=:]\s*"([0-9a-f]{32})"/) || [])[1];
  if (!id) { // already exists from an earlier run: look it up
    const list = wrangler(['kv', 'namespace', 'list']).out;
    try { id = JSON.parse(list.slice(list.indexOf('['), list.lastIndexOf(']') + 1)).find(n => /STATS$/.test(n.title))?.id; } catch {}
  }
  if (!id) die('Could not create the KV namespace:\n' + r.out);
  fs.writeFileSync(TOML, toml.replace('REPLACE_WITH_KV_NAMESPACE_ID', id)); ok(`Created (${id})`);
} else ok('Already set in wrangler.toml');

step('Deploying the Worker');
const dep = wrangler(['deploy']); if (dep.code !== 0) die('Deploy failed:\n' + dep.out);
const url = (dep.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [])[0]; if (!url) die('Deployed, but could not find the Worker URL in:\n' + dep.out);
ok(url);

step('Storing the summary token');
const summary = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : randomBytes(24).toString('hex');
const tmp = path.join(os.tmpdir(), `mr-secrets-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify({ SUMMARY_TOKEN: summary }), { mode: 0o600 });
const sec = wrangler(['secret', 'bulk', `"${tmp}"`]); fs.rmSync(tmp, { force: true });
if (sec.code !== 0) die('Could not store the secret:\n' + sec.out);
fs.writeFileSync(TOKEN_FILE, summary + '\n'); ok('SUMMARY_TOKEN');

step('Testing the Worker');
let st;
for (let i = 0; i < 6 && !st?.ok; i++) { // new deploys can take a few seconds to go live
  st = await fetch(url + '/stats', { method: 'POST', headers: { origin: SITE }, body: JSON.stringify({ v: 1, deck: 'setup-test@0', mode: 'test', cards: {} }) }).catch(() => null);
  if (!st?.ok) await new Promise(r => setTimeout(r, 3000));
}
if (!st?.ok) die(`The Worker isn't answering yet. Check it in the Cloudflare dashboard (${url}).`);
ok('/stats accepts records');

step('Updating public/env.js');
fs.writeFileSync(ENV, fs.readFileSync(ENV, 'utf8').replace(/export const STATS_URL = '.*';/, `export const STATS_URL = '${url}/stats';`));
ok('STATS_URL set');

console.log(c.b('\nDone.'));
console.log(`  Card stats summary: ${url}/summary?token=${summary}`);
console.log(c.d('  (token saved in cloudflare/summary-token.txt, which git ignores)'));
console.log('\n  To go live, commit and push public/env.js and cloudflare/wrangler.toml:');
console.log(c.d('    git add public/env.js cloudflare/wrangler.toml && git commit -m "Enable card stats" && git push\n'));
