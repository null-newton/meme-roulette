// Host-authoritative round engine. Runs on whichever phone is host; every peer holds a mirror so any can take over.
import { DECK, deckIds } from './cards.js';
export const MODES = { classic: 'Classic', roulette: 'Roulette', crowd: 'Crowd vote', writein: 'Write-in', speed: 'Speed' };
export const MODE_INFO = { classic: 'Rotating judge picks the funniest caption', roulette: 'Classic + guess whose photo it is (+1)', crowd: 'No judge — everyone votes, not for themselves', writein: 'Type your own captions instead of cards', speed: '20 s to caption, 15 s to judge, first to 5' };
export const DEFAULTS = { mode: 'classic', target: 7, fixed: false, rounds: 15, capT: 45, judgeT: 30, perPlayer: 15, reveal: 'after', writeins: 'off', deck: 'standard', swaps: 1 };
const RULES = { mode: Object.keys(MODES), target: [3, 15], fixed: 'bool', rounds: [10, 30], capT: [20, 90], judgeT: [15, 60], perPlayer: [10, 30], reveal: ['never', 'after', 'always'], writeins: ['off', 'one', 'unlimited'], deck: ['family', 'standard', 'spicy'], swaps: [0, 3] };
export const HAND = 7, MAX_PLAYERS = 10, MIN_PLAYERS = 3, MIN_POOL = 3;
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = a => a[Math.random() * a.length | 0];
export const capText = c => c?.text ?? '';
export const eff = s => s.settings.mode === 'speed' ? { ...s.settings, capT: 20, judgeT: 15, target: 5, fixed: false } : s.settings;
export const guessing = s => s.settings.mode === 'roulette';
export const showOwner = (s, phase = s.phase) => guessing(s) ? ['result', 'over'].includes(phase) : s.settings.reveal === 'always' || (s.settings.reveal === 'after' && ['result', 'over'].includes(phase));
export const canWrite = (s, p) => s.settings.mode === 'writein' || s.settings.writeins === 'unlimited' || (s.settings.writeins === 'one' && (p?.writeins || 0) < 1);
export const active = p => p && p.online && p.status === 'ready';
// Photos that can be drawn: not removed and never flagged for nudity (nude photos are never allowed)
export const livePool = s => { const f = new Set(Object.values(s.players).flatMap(p => p.flagged || [])); return Object.keys(s.pool).filter(pid => !s.removed.includes(pid) && !f.has(pid)); };
export const newState = (code, hostId) => ({ code, hostId, epoch: 0, ver: 0, phase: 'lobby', settings: { ...DEFAULTS }, players: {}, order: [], judgeIdx: -1, round: 0, pool: {}, used: [], queue: [], drawn: {}, photo: null, owner: null, judge: null, subs: {}, guesses: {}, cands: [], view: 0, votes: {}, deadline: 0, revealAt: 0, result: null, best: [], deck: [], deckVer: null, texts: {}, reports: {}, removed: [], kicked: [] });

export function setSetting(st, k, v) {
  const r = RULES[k]; if (!r) return;
  if (r === 'bool') st[k] = v === true || v === 'true';
  else if (typeof r[0] === 'number') { v = +v; if (!isNaN(v)) st[k] = Math.max(r[0], Math.min(r[1], Math.round(v))); }
  else if (r.includes(v)) st[k] = v;
}

const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'cock', 'pussy', 'bastard', 'wank', 'twat', 'slut', 'whore', 'piss', 'bollock'];
const SLURS = /\b(n[i1]gg(a|er|ah)|f[a@]gg?(ot)?|retard(ed)?|tranny|chink|spic|kike|wetback|gook|coon|dyke|paki)s?\b/i;
const BAD_RE = new RegExp(`\\b\\w*(${BAD.join('|')})\\w*\\b`, 'gi');
// Trims a write-in to 80 chars, masks profanity, returns null when it contains a slur
export function filterText(t) {
  t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!t || SLURS.test(t)) return null;
  return t.replace(BAD_RE, w => w[0] + '*'.repeat(w.length - 1));
}
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';

export class Host {
  constructor(app) { this.app = app; this.t = null; this.iv = setInterval(() => this.check(), 1000); }
  get s() { return this.app.s; }
  stop() { clearTimeout(this.t); clearInterval(this.iv); }
  commit() { this.s.ver++; this.app.broadcastState(); }
  arm(at) { clearTimeout(this.t); this.t = setTimeout(() => { this.timeout(); this.commit(); }, Math.max(0, at - Date.now())); }
  resume() { if (['caption', 'judge', 'vote', 'result'].includes(this.s.phase)) this.arm(this.s.deadline); }
  timeout() { const p = this.s.phase; p === 'caption' ? this.toJudging() : p === 'judge' ? this.toVote() : p === 'vote' ? this.tally() : p === 'result' && this.next(); }
  online(id) { return id === this.app.id || this.app.net.ch.has(id); }

  intent(from, m) {
    const s = this.s, p = s.players[from], isHost = from === s.hostId;
    if (!m || (!p && m.a !== 'hello')) return;
    switch (m.a) {
      case 'hello': {
        if (s.kicked.includes(from)) return this.app.net.send(from, { t: 'kicked' });
        if (!p) {
          if (Object.keys(s.players).length >= MAX_PLAYERS) return;
          s.players[from] = { id: from, name: cleanName(m.name), avatar: String(m.avatar || '🙂').slice(0, 4), status: 'joined', score: 0, hand: [], swaps: 0, writeins: 0, photos: [], online: true, off: 0, joinedAt: Date.now() };
          if (s.phase !== 'lobby') s.order.push(from);
        } else Object.assign(p, { online: true, off: 0, name: cleanName(m.name || p.name), avatar: String(m.avatar || p.avatar).slice(0, 4) });
        this.setStatus(from, m.status, m.photos, m.flagged); break;
      }
      case 'status': this.setStatus(from, m.status, m.photos, m.flagged); break;
      case 'settings': if (isHost && s.phase === 'lobby') setSetting(s.settings, m.k, m.v); break;
      case 'kick': if (isHost && m.id !== from && s.players[m.id]) { s.kicked.push(m.id); this.app.net.send(m.id, { t: 'kicked' }); this.removePlayer(m.id); } break;
      case 'start': if (isHost && s.phase === 'lobby' && this.canStart()) this.startGame(); break;
      case 'rematch': if (isHost && s.phase === 'over') this.startGame(); break;
      case 'lobby': if (isHost && s.phase === 'over') { clearTimeout(this.t); s.phase = 'lobby'; } break;
      case 'guess': if (s.phase === 'caption' && guessing(s) && from !== s.owner && s.players[m.id] && m.id !== from) s.guesses[from] = m.id; break;
      case 'submit': {
        if (s.phase !== 'caption' || from === s.judge || s.subs[from] || p.status !== 'ready') return;
        if (m.text != null) {
          if (!canWrite(s, p)) return; const t = filterText(m.text); if (!t) return this.app.notify(from, "That caption can't be used — try another");
          s.subs[from] = { text: t }; if (s.settings.mode !== 'writein') p.writeins++;
        } else {
          const i = p.hand.indexOf(m.card); if (i < 0 || s.settings.mode === 'writein') return;
          p.hand.splice(i, 1); s.subs[from] = { card: m.card, text: s.texts[m.card] }; this.stat(m.card, 'played');
        }
        if (this.allIn()) this.toJudging(); break;
      }
      case 'swap': if (p.swaps < eff(s).swaps && s.phase !== 'lobby') { p.swaps++; p.hand = []; this.fill(p); } break;
      case 'view': if (from === s.judge && s.phase === 'judge') s.view = Math.max(0, Math.min(s.cands.length - 1, m.i | 0)); break;
      case 'crown': if (from === s.judge && s.phase === 'judge' && s.cands.some(c => c.sid === m.sid)) this.finish(m.sid); break;
      case 'vote': {
        const c = s.cands.find(c => c.sid === m.sid);
        if (s.phase !== 'vote' || !c || c.by === from) return;
        s.votes[from] = m.sid; if (this.allVoted()) this.tally(); break;
      }
      case 'report': { const r = s.reports[m.pid] ||= []; if (!r.includes(from)) r.push(from); if (r.length >= 3) this.removePhoto(m.pid); break; }
      case 'remove': if (s.pool[m.pid] && (s.pool[m.pid] === from || isHost)) this.removePhoto(m.pid); break;
      case 'leave': this.removePlayer(from); break;
      default: return;
    }
    this.commit();
  }

  setStatus(id, status, photos, flagged) {
    const s = this.s, p = s.players[id]; if (!p) return;
    if (['joined', 'choosing', 'ready'].includes(status)) p.status = status;
    if (Array.isArray(photos)) {
      const list = photos.filter(x => typeof x === 'string' && x.length <= 16).slice(0, 30);
      for (const pid of p.photos) if (!list.includes(pid) && !s.used.includes(pid)) delete s.pool[pid];
      for (const pid of list) if (!s.pool[pid]) s.pool[pid] = id;
      p.photos = list; p.flagged = Array.isArray(flagged) ? flagged.filter(x => list.includes(x)) : [];
    }
  }
  canStart() { const s = this.s; return DECK.cards.length > 0 &&Object.values(s.players).filter(active).length >= MIN_PLAYERS && livePool(s).length >= MIN_POOL; }
  removePlayer(id) {
    const s = this.s; if (!s.players[id]) return;
    const i = s.order.indexOf(id); if (i >= 0) { s.order.splice(i, 1); if (i <= s.judgeIdx) s.judgeIdx--; }
    delete s.players[id]; delete s.subs[id]; delete s.guesses[id]; delete s.votes[id];
    for (const pid in s.pool) if (s.pool[pid] === id) delete s.pool[pid];
    s.queue = s.queue.filter(pid => s.pool[pid]); s.best = s.best.filter(b => s.pool[b.pid]);
    if (['caption', 'judge', 'vote'].includes(s.phase) && s.owner === id) this.startRound();
    else if (s.phase === 'judge' && s.judge === id) this.toVote();
  }
  removePhoto(pid) {
    const s = this.s; if (!s.removed.includes(pid)) s.removed.push(pid);
    s.queue = s.queue.filter(x => x !== pid); s.best = s.best.filter(b => b.pid !== pid);
    if (pid === s.photo && ['caption', 'judge', 'vote', 'result'].includes(s.phase)) this.startRound();
  }

  startGame() {
    const s = this.s; this.stats = {};
    Object.assign(s, { deck: shuffle(deckIds(eff(s).deck)), deckVer: DECK.id + '@' + DECK.version, texts: {}, used: [], queue: [], best: [], round: 0, drawn: {}, judgeIdx: -1, order: shuffle(Object.keys(s.players)) });
    for (const p of Object.values(s.players)) Object.assign(p, { score: 0, hand: [], swaps: 0, writeins: 0 });
    this.startRound();
  }
  // Deals up to 7 cards; card text rides along in state (s.texts) so peers never need the deck file
  fill(p) {
    const s = this.s;
    while (p.hand.length < HAND) {
      if (!s.deck.length) { const held = new Set(Object.values(s.players).flatMap(x => x.hand)); s.deck = shuffle(deckIds(eff(s).deck).filter(id => !held.has(id))); if (!s.deck.length) return; }
      const id = s.deck.pop(), c = DECK.byId.get(id); if (!c) continue;
      p.hand.push(id); s.texts[id] = c.text; this.stat(id, 'dealt');
    }
  }
  // Drops text for cards no longer in any hand to keep state small
  pruneTexts() { const s = this.s, keep = new Set(Object.values(s.players).flatMap(p => p.hand)); for (const id in s.texts) if (!keep.has(id)) delete s.texts[id]; }
  // Anonymous per-card counters for this game: dealt / played / won (no photos, names or write-in text)
  stat(id, k) { if (!id) return; const c = (this.stats ||= {})[id] ||= { dealt: 0, played: 0, won: 0 }; c[k]++; }
  reachable(pid) { const o = this.s.pool[pid]; return !!o && (this.online(o) || this.app.photos.has(pid)); }
  // Picks a photo from the owner with the fewest draws so far, never repeating within a game
  drawOne() {
    const s = this.s, by = {};
    for (const pid of livePool(s)) if (!s.used.includes(pid) && !s.queue.includes(pid) && this.reachable(pid)) (by[s.pool[pid]] ||= []).push(pid);
    const owners = Object.keys(by); if (!owners.length) return null;
    const min = Math.min(...owners.map(o => s.drawn[o] || 0)), o = pick(owners.filter(o => (s.drawn[o] || 0) === min));
    s.drawn[o] = (s.drawn[o] || 0) + 1; return pick(by[o]);
  }
  startRound() {
    const s = this.s, e = eff(s); clearTimeout(this.t);
    s.queue = s.queue.filter(pid => s.pool[pid] && !s.removed.includes(pid) && this.reachable(pid));
    while (s.queue.length < 3) { const d = this.drawOne(); if (!d) break; s.queue.push(d); }
    const pid = s.queue.shift(); if (!pid) return this.over();
    s.used.push(pid); s.photo = pid; s.owner = s.pool[pid]; s.round++;
    s.judge = null;
    if (e.mode !== 'crowd' && s.order.some(i => active(s.players[i]))) {
      do s.judgeIdx = (s.judgeIdx + 1) % s.order.length; while (!active(s.players[s.order[s.judgeIdx]]));
      s.judge = s.order[s.judgeIdx];
    }
    this.pruneTexts(); for (const p of Object.values(s.players)) this.fill(p);
    Object.assign(s, { phase: 'caption', subs: {}, guesses: {}, cands: [], votes: {}, view: 0, result: null, revealAt: Date.now() + 1500 });
    s.deadline = s.revealAt + e.capT * 1000;
    this.need(); this.arm(s.deadline);
  }
  // Asks owners to stream the current photo and the next two; falls back to the host's cached copy
  need() { const s = this.s; for (const pid of [s.photo, ...s.queue]) { const o = s.pool[pid]; o && o !== this.app.id && this.online(o) ? this.app.net.send(o, { t: 'need', pid }) : this.app.pushPhoto(pid); } }
  eligible() { const s = this.s; return Object.values(s.players).filter(p => active(p) && p.id !== s.judge); }
  allIn() { const el = this.eligible(); return el.length > 0 && el.every(p => this.s.subs[p.id]); }
  voters() { const s = this.s; return Object.values(s.players).filter(p => active(p) && s.cands.some(c => c.by !== p.id)); }
  allVoted() { const v = this.voters(); return v.length > 0 && v.every(p => this.s.votes[p.id]); }
  toJudging() {
    const s = this.s;
    s.cands = shuffle(Object.entries(s.subs).map(([by, c]) => ({ sid: Math.random().toString(36).slice(2, 8), by, ...c })));
    if (!s.cands.length) return this.finish(null);
    if (s.judge && active(s.players[s.judge])) { s.phase = 'judge'; s.view = 0; s.deadline = Date.now() + eff(s).judgeT * 1000; this.arm(s.deadline); }
    else this.toVote();
  }
  toVote() { const s = this.s; s.phase = 'vote'; s.votes = {}; s.deadline = Date.now() + eff(s).judgeT * 1000; if (!this.voters().length) return this.tally(); this.arm(s.deadline); }
  tally() {
    const s = this.s, c = {}; for (const sid of Object.values(s.votes)) c[sid] = (c[sid] || 0) + 1;
    const max = Math.max(0, ...Object.values(c));
    this.finish(max ? pick(Object.keys(c).filter(k => c[k] === max)) : s.cands.length === 1 ? s.cands[0].sid : null, c);
  }
  finish(sid, votes) {
    const s = this.s, w = s.cands.find(c => c.sid === sid);
    if (w && s.players[w.by]) s.players[w.by].score++; if (w) this.stat(w.card, 'won');
    const right = guessing(s) ? Object.keys(s.guesses).filter(i => s.guesses[i] === s.owner && s.players[i]) : [];
    right.forEach(i => s.players[i].score++);
    s.result = { sid: w?.sid || null, by: w?.by || null, text: w ? capText(w) : null, votes: votes || null, right };
    if (w) s.best.push({ pid: s.photo, owner: s.owner, by: w.by, text: capText(w) });
    s.phase = 'result'; s.deadline = Date.now() + 5000; this.arm(s.deadline);
  }
  next() { const s = this.s, e = eff(s), top = Math.max(0, ...Object.values(s.players).map(p => p.score)); (e.fixed ? s.round >= e.rounds : top >= e.target) ? this.over() : this.startRound(); }
  over() { clearTimeout(this.t); Object.assign(this.s, { phase: 'over', deadline: 0 }); if (this.stats && Object.keys(this.stats).length) this.app.reportStats?.(this.s.deckVer, this.stats); this.stats = null; }
  // Recomputes presence from open channels; drops players gone > 60 s and unsticks phases
  check() {
    const s = this.s, now = Date.now(); let ch = false;
    for (const p of Object.values(s.players)) {
      const on = this.online(p.id); if (on !== p.online) { p.online = on; p.off = on ? 0 : now; ch = true; }
      if (!on && now - p.off > 60000) { this.removePlayer(p.id); ch = true; }
    }
    if (s.phase === 'judge' && !active(s.players[s.judge])) { this.toVote(); ch = true; }
    else if (s.phase === 'caption' && now >= s.revealAt && this.allIn()) { this.toJudging(); ch = true; }
    else if (s.phase === 'vote' && this.allVoted()) { this.tally(); ch = true; }
    if (ch) this.commit();
  }
}
