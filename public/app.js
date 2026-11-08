// Meme Roulette client: screens, peer messaging, host takeover. The host phone runs engine.js; everyone mirrors its state.
import { Net } from './net.js';
import { Host, newState, eff, guessing, showOwner, canWrite, capText, active, livePool, MODES, MODE_INFO, MIN_PLAYERS, MIN_POOL } from './engine.js';
import { loadDeck, DECK } from './cards.js';
import { STATS_URL } from './env.js';
import { processFiles, loadStash, saveStash, memeBlob, flagAll } from './photos.js';

const $ = q => document.querySelector(q), root = $('#app');
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b & 31]).join('');
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const buzz = p => { try { navigator.userActivation?.hasBeenActive !== false && navigator.vibrate?.(p); } catch {} };
const AVATARS = ['😎', '🤡', '🐸', '🦄', '🐶', '🐱', '👽', '🤖', '🦊', '🐼', '🍕', '🌮', '👻', '🐙', '🦖', '🥑', '🐧', '🔥'];
const STATUS = { joined: 'Joined', choosing: 'Choosing photos', ready: 'Ready' };

const A = { id: null, s: null, net: null, host: null, offset: 0, photos: new Map(), mine: new Set(), flagged: new Set(), sent: new Map(), seen: '', mig: 0, pendingSave: null, bip: null };
const urlRoom = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
const L = { view: ls.get('age17') ? 'home' : 'age', name: ls.get('name') || '', avatar: ls.get('avatar') || AVATARS[Math.random() * AVATARS.length | 0], code: urlRoom, status: 'joined', sel: -1, wtext: '', jv: 0, vv: 0, all: [], pick: [], sheet: null, menuPid: null, toast: '', busy: '', qr: false, stash: 0, consent: null, late: false, blocked: false };
const hnow = () => Date.now() + A.offset;
const me = () => A.s?.players[A.id];
const isHost = () => !!A.host;
const pname = id => A.s?.players[id]?.name || 'Someone';
let toastT;
function toast(msg) { L.toast = msg; render(); clearTimeout(toastT); toastT = setTimeout(() => { L.toast = ''; render(); }, 2600); }

// ---------- networking glue ----------
A.notify = (id, msg) => id === A.id ? toast(msg) : A.net.send(id, { t: 'toast', msg });
A.broadcastState = () => { A.net.broadcast({ t: 'state', s: A.s, now: Date.now() }); afterState(); };
A.pushPhoto = pushPhoto;
A.reportStats = (deck, cards) => { if (!STATS_URL) return; try { navigator.sendBeacon(STATS_URL, JSON.stringify({ v: 1, deck, mode: A.s?.settings.mode, cards })); } catch {} };

async function enter(code) {
  if (!L.name.trim()) return toast('Pick a nickname first');
  ls.set('name', L.name.trim()); ls.set('avatar', L.avatar);
  A.id = (code && sessionStorage.getItem('mr-id-' + code)) || rid();
  Object.assign(A, { s: null, host: null, offset: 0, seen: '' }); Object.assign(L, { view: 'room', busy: 'Connecting…', status: code && sessionStorage.getItem('mr-co-' + code) ? 'ready' : 'joined', late: false });
  render();
  A.net = new Net(A.id, { joined: onJoined, error: e => { toast(e); leave(true); }, msg: onMsg, up: onUp, down: onDown, photo: onPhoto, host: () => {}, left: id => A.s && id === A.s.hostId && armMigrate() });
  await A.net.connect(code, !code);
}
function onJoined(m) {
  sessionStorage.setItem('mr-id-' + m.code, A.id); L.code = m.code; history.replaceState(null, '', '?room=' + m.code);
  if (!A.s && m.host === A.id && !m.peers.length) { A.s = newState(m.code, A.id); A.host = new Host(A); hello(); }
  L.busy = m.peers.length ? 'Connecting to players…' : ''; render();
}
function hello() { intent({ a: 'hello', name: L.name, avatar: L.avatar, status: L.status, photos: [...A.mine], flagged: [...A.flagged] }); }
function intent(m) { if (A.host) A.host.intent(A.id, m); else if (A.s) A.net.send(A.s.hostId, { t: 'intent', m }); }
function onMsg(from, m) {
  switch (m.t) {
    case 'state': return accept(from, m);
    case 'intent': return A.host?.intent(from, m.m);
    case 'need': return pushPhoto(m.pid);
    case 'toast': return toast(m.msg);
    case 'sync': return A.s && A.net.send(from, { t: 'mirror', s: A.s, now: Date.now() });
    case 'mirror': if (!A.s) { A.offset = m.now - Date.now(); A.s = m.s; m.s.hostId === A.id ? takeover() : A.net.ch.has(m.s.hostId) && hello(); afterState(); } return;
    case 'kicked': toast('You were removed from the room'); return leave(true);
    case 'saveReq': if (A.s?.pool[m.pid] === A.id) { L.consent = { from, pid: m.pid, text: m.text, until: Date.now() + 10000 }; buzz(40); render(); setTimeout(() => L.consent?.pid === m.pid && answerSave(false), 10000); } return;
    case 'saveRes': if (A.pendingSave?.pid === m.pid) { clearTimeout(A.pendingSave.t); const p = A.pendingSave; A.pendingSave = null; m.ok ? downloadMeme(p.pid, p.text) : toast('The photo owner said no'); } return;
  }
}
// Accepts host state; a higher epoch (after migration) or a handoff wins over the host we knew
function accept(from, m) {
  const s = m.s; if (!s) return;
  const known = A.s?.hostId, handoff = m.handoff && from === known;
  if (!handoff && s.hostId !== from) return;
  if (A.s && !handoff && from !== known && (s.epoch || 0) <= (A.s.epoch || 0)) return;
  A.offset = m.now - Date.now();
  if (A.host && s.hostId !== A.id) { A.host.stop(); A.host = null; }
  const changed = known !== s.hostId; A.s = s;
  if (s.hostId === A.id && !A.host) return takeover();
  if (changed || !s.players[A.id]) hello();
  afterState();
}
function takeover() {
  const s = A.s, o = A.offset; clearTimeout(A.mig); A.migOn = false;
  if (s.deadline) s.deadline -= o; if (s.revealAt) s.revealAt -= o;
  const old = s.players[s.hostId]; if (old && old.id !== A.id) { old.online = false; old.off = Date.now(); }
  s.hostId = A.id; s.epoch = (s.epoch || 0) + 1; A.offset = 0;
  A.host?.stop(); A.host = new Host(A); A.net.claimHost();
  if (!s.players[A.id]) A.host.intent(A.id, { a: 'hello', name: L.name, avatar: L.avatar, status: L.status, photos: [...A.mine] });
  A.host.resume(); A.host.commit(); toast("You're the host now");
}
function onUp(id) {
  L.busy = '';
  if (A.host) A.net.send(id, { t: 'state', s: A.s, now: Date.now() });
  else if (!A.s) A.net.send(id, { t: 'sync' });
  else if (id === A.s.hostId) { clearTimeout(A.mig); A.migOn = false; hello(); }
  if (A.s && A.s.phase !== 'lobby') for (const pid of [A.s.photo, ...A.s.queue]) if (A.mine.has(pid)) pushPhoto(pid);
  render();
}
function onDown(id) {
  for (const set of A.sent.values()) set.delete(id);
  if (A.host) return A.host.check();
  if (A.s && id === A.s.hostId) armMigrate();
  render();
}
function armMigrate() { if (!A.migOn && !A.host) { A.migOn = true; A.mig = setTimeout(migrate, 10000); } }
// Host gone for 10 s: the longest-connected reachable player takes over from its mirrored state
function migrate() {
  A.migOn = false; const s = A.s; if (!s || A.host || A.net.ch.has(s.hostId)) return;
  const c = Object.values(s.players).filter(p => p.id !== s.hostId && (p.id === A.id || A.net.ch.has(p.id))).sort((a, b) => a.joinedAt - b.joinedAt);
  if (c[0]?.id === A.id) takeover(); else { A.migOn = true; A.mig = setTimeout(migrate, 8000); }
}
function pushPhoto(pid) {
  const p = A.photos.get(pid); if (!p || !A.net) return;
  const sent = A.sent.get(pid) || new Set; A.sent.set(pid, sent);
  const to = [...A.net.ch.keys()].filter(i => !sent.has(i) && A.s?.pool[pid] !== i); to.forEach(i => sent.add(i));
  if (to.length) A.net.sendPhoto(to, pid, p.blob);
}
function onPhoto(pid, blob) {
  if (A.photos.has(pid) || !A.s?.pool[pid] || A.s.removed.includes(pid)) return;
  A.photos.set(pid, { blob, url: URL.createObjectURL(blob) });
  if (pid === A.s.photo || ['result', 'over'].includes(A.s.phase)) render();
}
// Drops cached photos that left the pool, resets per-round UI, fires haptics
function afterState() {
  const s = A.s; if (!s) return;
  if (s.kicked.includes(A.id)) { toast('You were removed from the room'); return leave(true); }
  for (const [pid, p] of A.photos) if (!A.mine.has(pid) && (!s.pool[pid] || s.removed.includes(pid))) { URL.revokeObjectURL(p.url); A.photos.delete(pid); }
  const key = s.phase + s.round;
  if (key !== A.seen) {
    A.seen = key; Object.assign(L, { sel: -1, wtext: '', jv: 0, vv: 0 });
    if (s.phase === 'result' && s.result?.by === A.id) buzz([60, 40, 120]);
    if (L.sheet === 'menu') L.sheet = null;
  }
  if (s.phase === 'over') for (const b of s.best) if (A.mine.has(b.pid)) pushPhoto(b.pid);
  render();
}
function leave(silent) {
  if (!silent && A.s) intent({ a: 'leave' });
  const net = A.net, host = A.host; setTimeout(() => net?.close(), silent ? 0 : 300); host?.stop(); clearTimeout(A.mig); A.migOn = false;
  for (const p of A.photos.values()) URL.revokeObjectURL(p.url);
  A.photos.clear(); A.mine.clear(); A.flagged.clear(); A.sent.clear(); Object.assign(A, { s: null, host: null, net: null });
  Object.assign(L, { view: 'home', sheet: null, status: 'joined', code: '', all: [], pick: [], qr: false });
  history.replaceState(null, '', location.pathname); render();
}
function hostLeave() {
  const s = A.s, next = Object.values(s.players).filter(p => p.id !== A.id && p.online).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!next) return leave(true);
  A.host.removePlayer(A.id); s.hostId = next.id; s.ver++;
  A.net.broadcast({ t: 'state', s, now: Date.now(), handoff: true }); A.host.stop(); A.host = null; leave(true);
}

// ---------- saving memes (owner consent) ----------
async function downloadMeme(pid, text) {
  const p = A.photos.get(pid); if (!p) return toast('Photo not available');
  const b = await memeBlob(p.blob, text), f = new File([b], 'meme-roulette.jpg', { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [f] })) try { return await navigator.share({ files: [f] }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'meme-roulette.jpg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function saveMeme(pid, text) {
  const owner = A.s.pool[pid];
  if (owner === A.id) return downloadMeme(pid, text);
  if (!A.net.ch.has(owner)) return toast("The photo's owner isn't here to approve");
  A.net.send(owner, { t: 'saveReq', pid, text });
  clearTimeout(A.pendingSave?.t);
  A.pendingSave = { pid, text, t: setTimeout(() => { A.pendingSave = null; toast('No answer — not saved'); }, 11000) };
  toast(`Asking ${pname(owner)} for permission…`);
}
function answerSave(ok) { const c = L.consent; if (!c) return; L.consent = null; A.net?.send(c.from, { t: 'saveRes', pid: c.pid, ok }); render(); }

// ---------- photos ----------
function samplePick() { const cap = A.s?.settings.perPlayer || 15, keep = L.all.filter(x => !x.drop && !x.flag); L.pick = [...(keep.length > cap ? [...keep].sort(() => Math.random() - 0.5).slice(0, cap) : keep), ...L.all.filter(x => x.flag)]; }
async function handleFiles(files) {
  if (!files?.length) return;
  L.busy = 'Preparing photos…'; render();
  const { blobs, skipped } = await processFiles(files, (i, n) => { L.busy = `Preparing photos… ${i}/${n}`; render(); });
  await setPicked(blobs);
  if (skipped) toast(`Skipped ${skipped} (screenshots, videos or unreadable files)`);
}
// Runs the on-device nudity check; flagged photos start dropped and need an extra confirmation
async function setPicked(blobs) {
  for (const x of L.all) URL.revokeObjectURL(x.url);
  L.busy = 'Running safety check…'; render();
  const flags = await flagAll(blobs, (i, n) => { L.busy = `Running safety check… ${i}/${n}`; render(); });
  L.busy = ''; L.unchecked = !flags && blobs.length > 0;
  L.all = blobs.map((b, i) => ({ blob: b, url: URL.createObjectURL(b), id: rid(), flag: !!flags?.[i], drop: !!flags?.[i] })); samplePick();
  L.view = blobs.length ? 'preview' : 'picker'; render();
}
function toggleDrop(x) { if (x.flag) return toast('Blocked: this photo may contain nudity'); x.drop = !x.drop; }
function confirmPhotos() {
  const chosen = L.pick.filter(x => !x.drop); if (!chosen.length) return toast('Keep at least one photo, or join caption-only');
  for (const pid of A.mine) if (!A.s.used.includes(pid)) { const p = A.photos.get(pid); p && URL.revokeObjectURL(p.url); A.photos.delete(pid); }
  A.mine.clear();
  A.flagged = new Set(chosen.filter(x => x.flag).map(x => x.id));
  for (const x of chosen) { A.mine.add(x.id); A.photos.set(x.id, { blob: x.blob, url: URL.createObjectURL(x.blob) }); }
  for (const x of L.all) URL.revokeObjectURL(x.url);
  saveStash(chosen.map(x => x.blob)); sessionStorage.removeItem('mr-co-' + L.code); L.all = []; L.pick = []; L.status = 'ready'; L.view = 'room';
  intent({ a: 'status', status: 'ready', photos: [...A.mine], flagged: [...A.flagged] }); buzz(30); render();
}

// ---------- views ----------
const avatarRow = () => `<div class="avatars">${AVATARS.map(a => `<button class="av ${a === L.avatar ? 'on' : ''}" data-act="avatar" data-v="${a}">${a}</button>`).join('')}</div>`;
function ageGate() {
  return `<div class="center pad"><div class="logo">🎰<span>Meme<br>Roulette</span></div>
  ${L.blocked ? '<p class="muted">Sorry — Meme Roulette is for players 17 and over.</p>' : `<h2>Are you 17 or older?</h2><p class="muted">Players share real photos from their phones. This game is rated 17+. <a href="privacy.html" class="lnk">Privacy &amp; safety</a></p>
  <button class="btn primary" data-act="age-ok">Yes, I'm 17+</button><button class="btn ghost" data-act="age-no">No</button>`}</div>`;
}
function home() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  return `<div class="home pad">
  <div class="logo">🎰<span>Meme<br>Roulette</span></div>
  <p class="tag">Caption your friends' real photos. Funniest card wins.</p>
  <label class="lbl">Nickname</label><input id="name" maxlength="16" placeholder="Your name" value="${esc(L.name)}" autocomplete="nickname">
  <label class="lbl">Avatar</label>${avatarRow()}
  <button class="btn primary big" data-act="create">Create game</button>
  <div class="joinrow"><input id="code" maxlength="6" placeholder="ROOM CODE" value="${esc(L.code)}" autocapitalize="characters" autocomplete="off"><button class="btn" data-act="join">Join</button></div>
  <p class="hint">Got a QR code? Scan it with your camera app.</p>
  ${A.bip ? '<button class="btn ghost" data-act="install">📲 Install app</button>' : ios ? '<p class="hint">📲 Install: tap <b>Share</b> → <b>Add to Home Screen</b></p>' : ''}
  <details class="how"><summary>How to play</summary><ol><li>Everyone adds 10–30 photos from their phone.</li><li>Each round, one photo appears on every phone.</li><li>Play your funniest caption card. The judge picks the winner.</li><li>First to the target score wins. In Roulette, guess whose photo it is for a bonus point.</li></ol></details>
  <p class="hint"><a href="privacy.html" class="lnk">Privacy &amp; safety</a> · No accounts, no ads. Photos never touch a server.</p>
  </div>`;
}
function lobby() {
  const s = A.s, st = s.settings, ps = Object.values(s.players).sort((a, b) => a.joinedAt - b.joinedAt), ready = ps.filter(active).length, pool = livePool(s).length;
  const can = ready >= MIN_PLAYERS && pool >= MIN_POOL && DECK.cards.length > 0;
  return `<div class="lobby pad">
  <div class="roomhead"><div><div class="lbl">Room code</div><div class="code">${s.code}</div></div>
  <div class="row-btns"><button class="btn sm" data-act="share">Share</button><button class="btn sm" data-act="qr">QR</button></div></div>
  ${L.qr ? '<div id="qr" class="qr"></div>' : ''}
  <div class="card list">${ps.map(p => `<div class="prow"><span class="pav">${p.avatar}</span><span class="pname">${esc(p.name)}${p.id === s.hostId ? ' <small>👑 host</small>' : ''}${p.id === A.id ? ' <small>(you)</small>' : ''}</span>
    <span class="chip ${p.online ? p.status : 'off'}">${p.online ? STATUS[p.status] + (p.status === 'ready' ? ` · ${p.photos.length ? p.photos.length + ' 📷' : 'caption only'}` : '') : 'Reconnecting…'}</span>
    ${isHost() && p.id !== A.id ? `<button class="x" data-act="kick" data-id="${p.id}" title="Kick">✕</button>` : ''}</div>`).join('')}
    <div class="muted small">${ps.length}/10 players · ${pool} photos in the pool</div></div>
  <div class="card"><div class="cardhead">Your photos</div>
    <p class="muted small">${L.status === 'ready' ? (A.mine.size ? `${A.mine.size} photos ready. They stay on your phone until drawn.` : 'Caption only — no photos.') : `Add ${st.perPlayer} photos for the best game.`}</p>
    <div class="row-btns"><button class="btn ${L.status === 'ready' ? '' : 'primary'}" data-act="photos">${L.status === 'ready' ? 'Change photos' : 'Choose photos'}</button>${L.status !== 'ready' ? '<button class="btn ghost" data-act="caption-only">Caption only</button>' : ''}</div></div>
  <div class="card"><div class="cardhead">Game settings ${isHost() ? '<button class="btn sm" data-act="settings">Edit</button>' : ''}</div>
    <div class="chips"><span class="chip">${MODES[st.mode]}</span><span class="chip">${st.fixed ? st.rounds + ' rounds' : eff(s).target + ' points to win'}</span><span class="chip">${eff(s).capT}s caption</span>${st.mode !== 'crowd' ? `<span class="chip">${eff(s).judgeT}s judge</span>` : ''}<span class="chip">${st.deck} deck</span><span class="chip">${st.swaps} hand swap${st.swaps === 1 ? '' : 's'}</span>${st.writeins !== 'off' && st.mode !== 'writein' ? `<span class="chip">write-ins: ${st.writeins}</span>` : ''}<span class="chip">owner: ${st.mode === 'roulette' ? 'guess it' : st.reveal}</span></div>
    <p class="muted small">${MODE_INFO[st.mode]}</p></div>
  ${isHost() ? `<button class="btn primary big" data-act="start" ${can ? '' : 'disabled'}>Start game</button><p class="hint">${can ? 'Everyone ready? Go!' : !DECK.cards.length ? 'Loading caption cards…' : `Need ${MIN_PLAYERS}+ ready players and ${MIN_POOL}+ photos (${ready} ready, ${pool} photos)`}</p>` : '<p class="hint">Waiting for the host to start…</p>'}
  <button class="btn ghost" data-act="leave">Leave room</button></div>`;
}
function picker() {
  return `<div class="pad"><button class="back" data-act="back">‹ Back</button><h2>Choose photos</h2>
  <p class="muted">Pick ${A.s.settings.perPlayer} funny, weird or embarrassing photos. Nothing leaves your phone until you confirm.</p>
  ${L.busy ? `<div class="card center"><div class="spinner"></div><p>${esc(L.busy)}</p></div>` : `
  <label class="src"><input type="file" id="file" accept="image/*" multiple hidden><b>🖼️ Hand-pick</b><span>Select photos in your phone's photo picker</span></label>
  ${L.stash ? `<button class="src" data-act="stash"><b>📦 Saved stash</b><span>Reuse your ${L.stash} photos from last game (stored only on this device)</span></button>` : ''}
  <div class="src disabled"><b>📚 Album</b><span>Available in the iOS and Android apps</span></div>
  <div class="src disabled"><b>🎲 Surprise me</b><span>Available in the iOS and Android apps</span></div>`}
  <button class="btn ghost" data-act="caption-only">Join with no photos</button></div>`;
}
function preview() {
  const cap = A.s.settings.perPlayer, kept = L.pick.filter(x => !x.drop).length, nf = L.all.filter(x => x.flag).length, clean = L.all.filter(x => !x.flag).length;
  return `<div class="pad"><button class="back" data-act="photos">‹ Pick again</button><h2>${kept} photo${kept === 1 ? '' : 's'}</h2>
  <p class="muted small">Tap a photo to drop it.${clean > cap ? ` You picked ${clean}; we randomly chose ${cap}.` : ''}</p>
  ${nf ? `<div class="notice warn">⚠️ ${nf} photo${nf === 1 ? '' : 's'} may contain nudity and ${nf === 1 ? 'was' : 'were'} blocked. Nude photos are never allowed.</div>` : ''}
  ${L.unchecked ? '<div class="notice warn">The safety check couldn\'t load, so these photos weren\'t checked. Double-check them yourself.</div>' : ''}
  <div class="grid">${L.pick.map((x, i) => `<button class="thumb ${x.drop ? 'drop' : ''} ${x.flag ? 'flag' : ''}" data-act="drop" data-i="${i}"><img src="${x.url}" alt=""></button>`).join('')}</div>
  ${clean > cap ? '<button class="btn" data-act="reroll">🎲 Re-roll picks</button>' : ''}
  <div class="notice">👀 These photos will be shown to everyone in this room. Nude photos are never allowed. <a href="privacy.html" class="lnk">Privacy</a></div>
  <button class="btn primary big" data-act="confirm">Confirm photos</button></div>`;
}
function late() {
  return `<div class="center pad"><h2>Game in progress</h2><p class="muted">Add your photos to the pool, or jump in and just caption.</p>
  <button class="btn primary" data-act="photos">Add photos</button><button class="btn" data-act="caption-only">Just caption</button><button class="btn ghost" data-act="leave">Leave</button></div>`;
}
function memeView(pid, text, extra = '') {
  const p = A.photos.get(pid), hidden = L.hidden?.has(pid);
  return `<div class="meme" data-pid="${pid || ''}">${hidden ? '<div class="ph">🙈 Hidden for you</div>' : p ? `<img src="${p.url}" alt="" draggable="false">` : '<div class="ph"><div class="spinner"></div>Loading photo…</div>'}
  <div class="cap" id="livecap">${esc(text || '')}</div>${extra}</div>`;
}
function ring(dl, total) { return `<div class="ring" data-dl="${dl}" data-total="${total}"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="bg"/><circle cx="18" cy="18" r="16" class="fg" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/></svg><span></span></div>`; }
function scores() {
  const s = A.s; return `<div class="scores">${Object.values(s.players).sort((a, b) => b.score - a.score).map(p => `<span class="sc ${p.online ? '' : 'off'} ${p.id === A.id ? 'me' : ''}" title="${esc(p.name)}">${p.avatar}<b>${p.score}</b>${p.id === s.judge && ['caption', 'judge'].includes(s.phase) ? '<i>⚖️</i>' : ''}</span>`).join('')}</div>`;
}
function ownerTag() {
  const s = A.s; if (s.owner === A.id) return '<div class="owner">📸 Your photo — act natural</div>';
  return showOwner(s) ? `<div class="owner">📸 ${esc(pname(s.owner))}'s photo</div>` : '';
}
function game() {
  const s = A.s, e = eff(s), phase = s.phase;
  const head = `<header class="bar"><div class="rnd">${phase === 'over' ? 'Game over' : `Round ${s.round}`}<small>${e.fixed ? `of ${e.rounds}` : `first to ${e.target}`}</small></div>${scores()}${['caption', 'judge', 'vote', 'result'].includes(phase) ? ring(s.deadline, phase === 'caption' ? e.capT : phase === 'result' ? 5 : e.judgeT) : '<div></div>'}</header>`;
  const body = phase === 'caption' ? captionView() : phase === 'judge' ? judgeView() : phase === 'vote' ? voteView() : phase === 'result' ? resultView() : overView();
  return `<div class="game">${head}<main>${body}</main></div>`;
}
function captionView() {
  const s = A.s, m = me(), judge = s.judge === A.id, before = hnow() < s.revealAt, sub = s.subs[A.id];
  const n = Object.keys(s.subs).length, tot = Object.values(s.players).filter(p => active(p) && p.id !== s.judge).length;
  if (before) return `<div class="getready"><div class="big-emoji">🎰</div><h2>Next photo…</h2>${judge ? '<p class="judge-badge">⚖️ You\'re the judge this round</p>' : ''}</div>`;
  if (judge) return `${memeView(s.photo, '')}${ownerTag()}<div class="panel center"><div class="judge-badge">⚖️ You're the judge</div><p>${n} / ${tot} captions in</p><p class="muted small">Sit back. You'll pick the funniest one.</p></div>`;
  const selText = L.sel >= 0 && m.hand[L.sel] != null ? s.texts[m.hand[L.sel]] : L.wtext;
  if (sub) return `${memeView(s.photo, capText(sub))}${ownerTag()}<div class="panel center"><p class="done">✓ Caption played</p><p class="muted">${n} / ${tot} in${s.judge ? ` · ${esc(pname(s.judge))} is judging` : ''}</p>${guessChips()}</div>`;
  const write = canWrite(s, m), cards = s.settings.mode !== 'writein';
  return `${memeView(s.photo, selText)}${ownerTag()}
  ${guessChips()}
  ${write ? `<div class="write"><input id="wtext" maxlength="80" placeholder="${cards ? 'Or write your own caption…' : 'Write your caption…'}" value="${esc(L.wtext)}" autocomplete="off"><button class="btn primary sm" data-act="writein">Play</button></div>${cards && s.settings.writeins === 'one' ? '<p class="hint">1 write-in per game</p>' : ''}` : ''}
  ${cards ? `<div class="hand" id="hand">${m.hand.map((c, i) => `<button class="ccard ${i === L.sel ? 'sel' : ''}" data-act="card" data-i="${i}">${esc(s.texts[c] || '')}</button>`).join('')}</div>
  <div class="row-btns">${L.sel >= 0 ? '<button class="btn primary" data-act="play">Play this card</button>' : '<span class="hint">Tap a card to preview, tap again to play</span>'}${m.swaps < eff(s).swaps ? `<button class="btn ghost sm" data-act="swap">Swap hand (${eff(s).swaps - m.swaps})</button>` : ''}</div>` : ''}`;
}
function guessChips() {
  const s = A.s; if (!guessing(s) || s.owner === A.id) return '';
  return `<div class="guess"><span class="lbl">Whose photo? +1</span><div class="chips">${Object.values(s.players).filter(p => p.id !== A.id).map(p => `<button class="chip pick ${s.guesses[A.id] === p.id ? 'on' : ''}" data-act="guess" data-id="${p.id}">${p.avatar} ${esc(p.name)}</button>`).join('')}</div></div>`;
}
function swiper(list, i, act) {
  const c = list[i]; if (!c) return '';
  return `<div class="swipe" data-swipe="${act}">${memeView(A.s.photo, capText(c), `<div class="count">${i + 1} / ${list.length}</div>`)}</div>
  <div class="nav"><button class="btn" data-act="${act}" data-d="-1" ${i ? '' : 'disabled'}>‹</button><div class="dots">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><button class="btn" data-act="${act}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'}>›</button></div>`;
}
function judgeView() {
  const s = A.s, judge = s.judge === A.id, i = judge ? Math.min(L.jv, s.cands.length - 1) : s.view;
  return `${swiper(s.cands, i, judge ? 'jv' : 'none')}${judge ? '<button class="btn primary big crown" data-act="crown">👑 Crown this one</button>' : `<p class="hint center">${esc(pname(s.judge))} is choosing the winner…</p>`}`;
}
function voteView() {
  const s = A.s, mine = s.votes[A.id], i = Math.min(L.vv, s.cands.length - 1), c = s.cands[i], own = c?.by === A.id;
  const why = s.settings.mode === 'crowd' ? 'Vote for the funniest!' : "The judge ran out of time — everyone votes!";
  return `<p class="hint center">${why}</p>${swiper(s.cands, i, 'vv')}
  ${mine ? `<p class="done center">✓ Voted${mine === c?.sid ? ' for this one' : ''}</p>` : ''}
  <button class="btn primary big" data-act="vote" ${own ? 'disabled' : ''}>${own ? "That's yours" : mine === c?.sid ? '✓ Your vote' : '🗳️ Vote for this'}</button>`;
}
function resultView() {
  const s = A.s, r = s.result || {};
  const reveal = showOwner(s) ? `<div class="owner">📸 Photo by ${esc(pname(s.owner))}${s.owner === A.id ? ' (you!)' : ''}</div>` : '';
  const guess = r.right?.length ? `<p class="muted center">🎯 +1 for guessing right: ${r.right.map(i => esc(pname(i))).join(', ')}</p>` : guessing(s) ? '<p class="muted center">Nobody guessed the owner</p>' : '';
  if (!r.by) return `${memeView(s.photo, '')}${reveal}<div class="panel center"><h2>No winner this round</h2>${guess}</div>`;
  return `<div class="win">${memeView(s.photo, r.text)}</div>${reveal}
  <div class="panel center"><h2 class="winner">🏆 ${esc(pname(r.by))}${r.by === A.id ? ' (you!)' : ''} wins the round <span class="plus">+1</span></h2>${guess}
  <button class="btn sm" data-act="save" data-pid="${s.photo}" data-text="${esc(r.text)}">💾 Save meme</button><p class="hint">Next round in a moment…</p></div>`;
}
function overView() {
  const s = A.s, ps = Object.values(s.players).sort((a, b) => b.score - a.score), top = ps[0];
  return `<div class="over"><div class="big-emoji">🏆</div><h2>${top ? esc(top.name) + ' wins!' : 'Game over'}</h2>
  <div class="card list">${ps.map((p, i) => `<div class="prow"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="pav">${p.avatar}</span><span class="pname">${esc(p.name)}</span><b>${p.score}</b></div>`).join('')}</div>
  ${s.best.length ? `<div class="lbl">Best of</div><div class="reel">${s.best.map(b => `<div class="reelitem">${memeView(b.pid, b.text)}<small>${esc(pname(b.by))}${showOwner(s) ? ` · 📸 ${esc(pname(b.owner))}` : ''}</small><button class="btn sm" data-act="save" data-pid="${b.pid}" data-text="${esc(b.text)}">💾 Save</button></div>`).join('')}</div>` : ''}
  ${isHost() ? '<button class="btn primary big" data-act="rematch">Rematch (same photos)</button><button class="btn" data-act="tolobby">Back to lobby</button>' : '<p class="hint">Waiting for the host to start a rematch…</p>'}
  <button class="btn ghost" data-act="leave">Leave</button></div>`;
}
function settingsSheet() {
  const st = A.s.settings, rng = (a, b, step = 1, suf = '') => { const o = []; for (let i = a; i <= b; i += step) o.push([i, i + suf]); return o; };
  const sel = (k, label, opts) => `<label class="srow"><span>${label}</span><select data-set="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(st[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const speed = st.mode === 'speed';
  return `<h3>Game settings</h3>
  ${sel('mode', 'Mode', Object.entries(MODES))}<p class="muted small">${MODE_INFO[st.mode]}</p>
  ${speed ? '' : sel('fixed', 'Game length', [[false, 'Points to win'], [true, 'Fixed rounds']])}
  ${speed ? '' : st.fixed ? sel('rounds', 'Rounds', rng(10, 30)) : sel('target', 'Points to win', rng(3, 15))}
  ${speed ? '' : sel('capT', 'Caption timer', rng(20, 90, 5, ' s'))}
  ${speed || st.mode === 'crowd' ? '' : sel('judgeT', 'Judge timer', rng(15, 60, 5, ' s'))}
  ${sel('perPlayer', 'Photos per player', rng(10, 30))}
  ${st.mode === 'roulette' ? '' : sel('reveal', 'Owner reveal', [['never', 'Never'], ['after', 'After judging'], ['always', 'Always visible']])}
  ${st.mode === 'writein' ? '' : sel('writeins', 'Write-ins', [['off', 'Off'], ['one', '1 per game'], ['unlimited', 'Unlimited']])}
  ${sel('deck', 'Card deck', [['family', 'Family'], ['standard', 'Standard'], ['spicy', 'Spicy (18+)']])}
  ${sel('swaps', 'Hand swaps', rng(0, 3))}
  <button class="btn primary" data-act="close-sheet">Done</button>`;
}
function menuSheet() {
  const pid = L.menuPid, own = A.s?.pool[pid] === A.id;
  return `<h3>Photo options</h3>
  <button class="btn" data-act="hide">🙈 Hide for me</button>
  ${own ? '<button class="btn" data-act="remove">🗑️ Remove my photo from the game</button>' : '<button class="btn" data-act="report">🚩 Report photo</button>'}
  ${isHost() && !own ? '<button class="btn danger" data-act="remove">🗑️ Remove from game (host)</button>' : ''}
  <button class="btn ghost" data-act="close-sheet">Cancel</button>`;
}
function screen() {
  if (L.view === 'age') return ageGate();
  if (L.view === 'home') return home();
  const s = A.s;
  if (!s || !s.players[A.id]) return `<div class="center pad"><div class="spinner"></div><p>${esc(L.busy || 'Joining room…')}</p>${L.code ? `<p class="muted">Room ${esc(L.code)}</p>` : ''}<button class="btn ghost" data-act="leave">Cancel</button></div>`;
  if (L.view === 'picker') return picker();
  if (L.view === 'preview') return preview();
  if (s.phase === 'lobby') return lobby();
  if (me().status !== 'ready') return late();
  return game();
}
function render() {
  const f = document.activeElement, fid = f?.id, ss = f?.selectionStart, se = f?.selectionEnd, hs = $('#hand')?.scrollLeft, rs = $('.reel')?.scrollLeft, y = scrollY;
  const sheet = L.consent ? `<h3>Save meme?</h3><p>${esc(pname(L.consent.from))} wants to save the meme made from your photo.</p><div class="meme mini">${A.photos.get(L.consent.pid) ? `<img src="${A.photos.get(L.consent.pid).url}" alt="">` : ''}<div class="cap">${esc(L.consent.text)}</div></div><button class="btn primary" data-act="consent" data-ok="1">Allow</button><button class="btn" data-act="consent" data-ok="">Don't allow</button><p class="hint">No answer in 10 s counts as no.</p>`
    : L.sheet === 'settings' && A.s ? settingsSheet() : L.sheet === 'menu' ? menuSheet() : '';
  root.innerHTML = screen() + (sheet ? `<div class="scrim" data-act="close-sheet"></div><div class="sheet">${sheet}</div>` : '') + (L.toast ? `<div class="toast">${esc(L.toast)}</div>` : '');
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(ss, se); } catch {} } }
  if (hs != null && $('#hand')) $('#hand').scrollLeft = hs;
  if (rs != null && $('.reel')) $('.reel').scrollLeft = rs;
  scrollTo(0, y); tick(); if (L.qr) drawQR();
}

// ---------- timers ----------
function tick() {
  for (const r of document.querySelectorAll('[data-dl]')) {
    const left = Math.max(0, (+r.dataset.dl - hnow()) / 1000), tot = +r.dataset.total;
    r.querySelector('span').textContent = Math.ceil(left); r.querySelector('.fg').setAttribute('stroke-dashoffset', String(100 - Math.min(100, left / tot * 100)));
    r.classList.toggle('low', left <= 5);
  }
  const s = A.s;
  if (s?.phase === 'caption' && hnow() >= s.revealAt && A.revealed !== s.round + ':' + s.epoch) { A.revealed = s.round + ':' + s.epoch; buzz(25); render(); }
}
setInterval(tick, 250);

// ---------- QR / share ----------
let qrLib;
async function drawQR() {
  const el = $('#qr'); if (!el) return;
  const url = `${location.origin}${location.pathname}?room=${A.s.code}`;
  if (!qrLib) qrLib = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; sc.onload = () => res(window.qrcode); sc.onerror = rej; document.head.appendChild(sc); });
  try { const q = (await qrLib)(0, 'M'); q.addData(url); q.make(); const e2 = $('#qr'); if (e2) e2.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) + `<small>${esc(url)}</small>`; }
  catch { const e2 = $('#qr'); if (e2) e2.innerHTML = `<small>QR unavailable offline. Link: ${esc(url)}</small>`; }
}
async function share() {
  const url = `${location.origin}${location.pathname}?room=${A.s.code}`, text = `Join my Meme Roulette game! Code ${A.s.code}`;
  if (navigator.share) try { return await navigator.share({ title: 'Meme Roulette', text, url }); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Share this link:', url); }
}

// ---------- events ----------
const act = {
  'age-ok': () => { ls.set('age17', true); L.view = 'home'; },
  'age-no': () => { L.blocked = true; },
  avatar: d => { L.avatar = d.v; ls.set('avatar', d.v); },
  create: () => enter(''),
  join: () => { const c = ($('#code')?.value || L.code).toUpperCase().trim(); if (c.length !== 6) return toast('Room codes have 6 characters'); L.code = c; enter(c); },
  install: async () => { A.bip?.prompt(); A.bip = null; },
  leave: () => { if (A.host && A.s && Object.keys(A.s.players).length > 1) return hostLeave(); leave(); },
  share, qr: () => { L.qr = !L.qr; },
  photos: async () => { L.view = 'picker'; if (L.status !== 'ready') intent({ a: 'status', status: 'choosing' }); L.stash = (await loadStash()).length; render(); },
  back: () => { L.view = 'room'; if (L.status !== 'ready') intent({ a: 'status', status: 'joined' }); },
  'caption-only': () => { for (const pid of A.mine) if (!A.s.used.includes(pid)) A.photos.delete(pid); A.mine.clear(); A.flagged.clear(); L.status = 'ready'; L.view = 'room'; sessionStorage.setItem('mr-co-' + L.code, '1'); intent({ a: 'status', status: 'ready', photos: [] }); },
  stash: async () => setPicked(await loadStash()),
  drop: d => toggleDrop(L.pick[+d.i]),
  reroll: () => { samplePick(); },
  confirm: confirmPhotos,
  kick: d => { if (confirm(`Remove ${pname(d.id)} from the room?`)) intent({ a: 'kick', id: d.id }); },
  settings: () => { L.sheet = 'settings'; },
  'close-sheet': () => { if (L.consent) return answerSave(false); L.sheet = null; },
  start: () => intent({ a: 'start' }),
  card: d => { const i = +d.i; if (L.sel === i) return act.play(); L.sel = i; L.wtext = ''; },
  play: () => { const c = me()?.hand[L.sel]; if (c == null) return; intent({ a: 'submit', card: c }); buzz(30); L.sel = -1; },
  writein: () => { const t = ($('#wtext')?.value || '').trim(); if (!t) return toast('Write something first'); intent({ a: 'submit', text: t }); buzz(30); },
  swap: () => { if (confirm('Swap your whole hand for 7 new cards?')) { intent({ a: 'swap' }); L.sel = -1; } },
  guess: d => intent({ a: 'guess', id: d.id }),
  jv: d => { L.jv = Math.max(0, Math.min(A.s.cands.length - 1, L.jv + +d.d)); intent({ a: 'view', i: L.jv }); },
  vv: d => { L.vv = Math.max(0, Math.min(A.s.cands.length - 1, L.vv + +d.d)); },
  crown: () => { const c = A.s.cands[Math.min(L.jv, A.s.cands.length - 1)]; if (c) { intent({ a: 'crown', sid: c.sid }); buzz([40, 30, 80]); } },
  vote: () => { const c = A.s.cands[Math.min(L.vv, A.s.cands.length - 1)]; if (c) { intent({ a: 'vote', sid: c.sid }); buzz(30); } },
  save: d => saveMeme(d.pid, d.text),
  consent: d => answerSave(!!d.ok),
  rematch: () => intent({ a: 'rematch' }),
  tolobby: () => intent({ a: 'lobby' }),
  hide: () => { (L.hidden ||= new Set).add(L.menuPid); L.sheet = null; },
  report: () => { intent({ a: 'report', pid: L.menuPid }); L.sheet = null; toast('Reported. Three reports remove a photo.'); },
  remove: () => { intent({ a: 'remove', pid: L.menuPid }); L.sheet = null; toast('Photo removed from the game'); },
};
root.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const f = act[el.dataset.act]; if (!f) return;
  const r = f(el.dataset, el); if (!(r instanceof Promise)) render();
});
root.addEventListener('input', e => {
  if (e.target.id === 'name') L.name = e.target.value;
  else if (e.target.id === 'code') { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); L.code = e.target.value; }
  else if (e.target.id === 'wtext') { L.wtext = e.target.value; L.sel = -1; const c = $('#livecap'); if (c) c.textContent = L.wtext; document.querySelectorAll('.ccard.sel').forEach(x => x.classList.remove('sel')); }
});
root.addEventListener('keydown', e => { if (e.key !== 'Enter') return; if (e.target.id === 'code') act.join(); else if (e.target.id === 'wtext') { act.writein(); render(); } });
root.addEventListener('change', e => {
  if (e.target.id === 'file') handleFiles(e.target.files);
  const k = e.target.dataset?.set; if (!k) return;
  let v = e.target.value;
  if (k === 'deck' && v === 'spicy' && !confirm('The Spicy deck has adult humour. Confirm that you (the host) are 18 or older.')) v = A.s.settings.deck;
  intent({ a: 'settings', k, v });
});
// Long-press (or right-click) on any photo opens Report / Hide / Remove
let lp;
root.addEventListener('pointerdown', e => { const m = e.target.closest('.meme[data-pid]'); if (!m || !m.dataset.pid) return; lp = setTimeout(() => { L.menuPid = m.dataset.pid; L.sheet = 'menu'; buzz(20); render(); }, 550); });
['pointerup', 'pointercancel', 'pointermove'].forEach(t => root.addEventListener(t, e => { if (t !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(lp); }));
root.addEventListener('contextmenu', e => { const m = e.target.closest('.meme[data-pid]'); if (!m?.dataset.pid) return; e.preventDefault(); clearTimeout(lp); L.menuPid = m.dataset.pid; L.sheet = 'menu'; render(); });
// Swipe left/right through captions while judging or voting
let sx = null;
root.addEventListener('touchstart', e => { if (e.target.closest('[data-swipe]')) sx = e.touches[0].clientX; }, { passive: true });
root.addEventListener('touchend', e => {
  const sw = e.target.closest('[data-swipe]'); if (sx == null || !sw) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) < 40 || !act[sw.dataset.swipe]) return; act[sw.dataset.swipe]({ d: dx < 0 ? 1 : -1 }); render();
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); A.bip = e; render(); });
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__mr = { A, L }; // debug handle
loadDeck().then(render).catch(() => toast("Couldn't load the caption cards. Check your connection."));
if (urlRoom && L.view === 'home' && L.name && sessionStorage.getItem('mr-id-' + urlRoom)) enter(urlRoom); else render();
