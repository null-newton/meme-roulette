// One-shot setup for the Meme Roulette Cloudflare Worker. Asks only for the TURN Token ID and API token.
// Run from the repo root: npm run setup:worker   (or: node cloudflare/setup.mjs)
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.dirname(DIR);
const TOML = path.join(DIR, 'wrangler.toml'), ENV = path.join(ROOT, 'public', 'env.js'), TOKEN_FILE = path.join(DIR, 'summary-token.txt');
const SITE = 'https://meme.zacsvae.com', WRANGLER = 'wrangler@4';
const c = { b: s => `\x1b[1m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` };
const step = s => console.log('\n' + c.b('▸ ' + s)), ok = s => console.log(c.g('  ✓ ' + s)), die = s => { console.error(c.r('\n✗ ' + s)); process.exit(1); };

// Runs wrangler via npx; interactive=true hands the terminal over (for login)
function wrangler(args, { interactive = false, input } = {}) {
  const r = spawnSync('npx', ['--yes', WRANGLER, ...args], { cwd: DIR, shell: true, encoding: 'utf8', input, stdio: interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' } });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}
// Prompts for a value; hidden=true masks typing (for the API token)
function ask(q, hidden = false) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => rl.output.write(s.includes(q) ? s : s.replace(/[^\r\n]/g, '•'));
    rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a.trim()); });
  });
}

console.log(c.b('\nMeme Roulette — Cloudflare Worker setup'));
console.log(c.d('Deploys cloudflare/worker.js: TURN relay credentials (/ice) and anonymous card stats (/stats).'));
console.log(c.d('Get the two values in the Cloudflare dashboard: Realtime → TURN Server → Create.\n'));

const keyId = await ask('TURN Token ID: '), apiToken = await ask('TURN API token: ', true);
if (!/^[A-Za-z0-9]{16,64}$/.test(keyId)) die('That TURN Token ID looks wrong (letters and digits only).');
if (apiToken.length < 20) die('That API token looks too short.');

step('Checking the TURN credentials with Cloudflare');
const t = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, { method: 'POST', headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 60 }) }).catch(e => ({ ok: false, status: e.message }));
if (!t.ok) die(`Cloudflare rejected the TURN credentials (${t.status}). Check the Token ID and API token.`);
ok('TURN credentials work');

step('Signing in to Cloudflare');
if (!/You are logged in|associated with the email/i.test(wrangler(['whoami']).out)) {
  console.log('  A browser window will open; approve access there.');
  if (wrangler(['login'], { interactive: true }).code !== 0) die('Cloudflare login failed.');
}
const who = wrangler(['whoami']).out; if (!/You are logged in|associated with the email/i.test(who)) die('Still not logged in to Cloudflare.');
ok('Logged in' + ((who.match(/email ([^\s.]+@[^\s]+?)\.?\s/) || [])[1] ? ` as ${who.match(/email ([^\s.]+@[^\s]+?)\.?\s/)[1]}` : ''));

step('Creating the stats storage (KV namespace)');
let toml = fs.readFileSync(TOML, 'utf8');
if (/id = "REPLACE_WITH_KV_NAMESPACE_ID"/.test(toml)) {
  let r = wrangler(['kv', 'namespace', 'create', 'STATS']), id = (r.out.match(/"?id"?\s*[=:]\s*"([0-9a-f]{32})"/) || [])[1];
  if (!id) { // already exists from an earlier run: look it up
    const list = wrangler(['kv', 'namespace', 'list']).out, arr = JSON.parse(list.slice(list.indexOf('['), list.lastIndexOf(']') + 1) || '[]');
    id = arr.find(n => /STATS$/.test(n.title))?.id;
  }
  if (!id) die('Could not create the KV namespace:\n' + r.out);
  toml = toml.replace('REPLACE_WITH_KV_NAMESPACE_ID', id); fs.writeFileSync(TOML, toml); ok(`Created (${id})`);
} else ok('Already set in wrangler.toml');

step('Deploying the Worker');
const dep = wrangler(['deploy']); if (dep.code !== 0) die('Deploy failed:\n' + dep.out);
const url = (dep.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [])[0]; if (!url) die('Deployed, but could not find the Worker URL in:\n' + dep.out);
ok(url);

step('Storing secrets');
const summary = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : randomBytes(24).toString('hex');
const tmp = path.join(os.tmpdir(), `mr-secrets-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify({ TURN_KEY_ID: keyId, TURN_KEY_API_TOKEN: apiToken, SUMMARY_TOKEN: summary }), { mode: 0o600 });
const sec = wrangler(['secret', 'bulk', `"${tmp}"`]); fs.rmSync(tmp, { force: true });
if (sec.code !== 0) die('Could not store secrets:\n' + sec.out);
fs.writeFileSync(TOKEN_FILE, summary + '\n'); ok('TURN_KEY_ID, TURN_KEY_API_TOKEN, SUMMARY_TOKEN');

step('Testing the Worker');
let ice;
for (let i = 0; i < 6 && !ice; i++) { // new deploys can take a few seconds to go live
  const r = await fetch(url + '/ice', { headers: { origin: SITE } }).catch(() => null);
  if (r?.ok) ice = (await r.json()).iceServers; else await new Promise(r => setTimeout(r, 3000));
}
if (!ice?.length) die(`The Worker didn't return relay servers. Check it in the Cloudflare dashboard (${url}/ice).`);
ok(`/ice returns ${ice.length} relay server entr${ice.length === 1 ? 'y' : 'ies'}`);
const st = await fetch(url + '/stats', { method: 'POST', headers: { origin: SITE }, body: JSON.stringify({ v: 1, deck: 'setup-test@0', mode: 'test', cards: {} }) }).catch(() => null);
st?.ok ? ok('/stats accepts records') : console.log(c.r('  ! /stats test failed (relay still works)'));

step('Updating public/env.js');
fs.writeFileSync(ENV, fs.readFileSync(ENV, 'utf8').replace(/export const ICE_URL = '.*';/, `export const ICE_URL = '${url}/ice';`).replace(/export const STATS_URL = '.*';/, `export const STATS_URL = '${url}/stats';`));
ok('ICE_URL and STATS_URL set');

console.log(c.b('\nDone.'));
console.log(`  Card stats summary: ${url}/summary?token=${summary}`);
console.log(c.d(`  (token saved in cloudflare/summary-token.txt, which git ignores)`));
console.log(`\n  To go live, commit and push public/env.js and cloudflare/wrangler.toml:`);
console.log(c.d('    git add public/env.js cloudflare/wrangler.toml && git commit -m "Enable Cloudflare relay and stats" && git push\n'));
