// WebRTC mesh. Signaling goes through our own server when present (server.js), else a public MQTT broker (static hosting, e.g. GitHub Pages).
import { ICE_URL } from './env.js';
// JSON control messages + chunked binary photos travel on one data channel per peer; signaling never carries game data or photos.
const CHUNK = 64000, PIDLEN = 16, enc = new TextEncoder(), dec = new TextDecoder();
const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const BROKER = 'wss://broker.emqx.io:8084/mqtt', TOPIC = 'meme-roulette/v1/', ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ABC[b & 31]).join('');
let mqttLib;
const loadMqtt = () => mqttLib ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js'; s.onload = () => res(window.mqtt); s.onerror = () => { mqttLib = null; rej(); }; document.head.appendChild(s); });

class WsSig {
  constructor(n) { this.n = n; this.open(); }
  open() {
    const n = this.n; if (n.closed) return;
    const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => this.raw(n.create && !n.code ? { t: 'create', id: n.id } : { t: 'join', code: n.code, id: n.id });
    ws.onmessage = e => n.sig(JSON.parse(e.data));
    ws.onclose = () => !n.closed && setTimeout(() => this.open(), 1500);
  }
  raw(m) { this.ws?.readyState === 1 && this.ws.send(JSON.stringify(m)); }
  signal(to, data) { this.raw({ t: 'signal', to, data }); }
  host() { this.raw({ t: 'host' }); }
  close() { this.ws?.close(); }
}
// Serverless signaling: room topic for presence (knock/here/bye), one inbox topic per peer for offers/answers/candidates
class MqttSig {
  constructor(n) { this.n = n; this.start(); }
  async start() {
    const n = this.n, mqtt = await loadMqtt().catch(() => null);
    if (!mqtt) return n.sig({ t: 'error', msg: "Can't reach the matchmaking service. Check your connection." });
    const code = n.code || newCode(), base = this.base = TOPIC + code + '/';
    const c = this.c = mqtt.connect(BROKER, { clientId: 'mr_' + n.id + '_' + Math.random().toString(36).slice(2, 6), clean: true, reconnectPeriod: 2000, connectTimeout: 10000, will: { topic: base + 'all', payload: JSON.stringify({ t: 'bye', id: n.id }), qos: 1 } });
    c.on('connect', () => c.subscribe([base + 'all', base + 'to/' + n.id], { qos: 1 }, () => {
      if (n.create && !n.code) { this.in = true; return n.sig({ t: 'joined', code, host: n.id, peers: [] }); }
      this.found = false; this.pub('all', { t: 'knock', id: n.id }); clearTimeout(this.to);
      this.to = setTimeout(() => !this.found && (this.in ? n.sig({ t: 'joined', code, host: null, peers: [] }) : n.sig({ t: 'error', msg: 'Room not found' })), 6000);
    }));
    c.on('message', (_, buf) => {
      let m; try { m = JSON.parse(buf); } catch { return; }
      if (m.id === n.id || m.from === n.id) return;
      if (m.t === 'knock' && this.in) this.pub('to/' + m.id, { t: 'here', id: n.id });
      else if (m.t === 'here') { if (!this.found) { this.found = this.in = true; n.sig({ t: 'joined', code, host: null, peers: [m.id] }); } else n.sig({ t: 'peer-here', id: m.id }); }
      else if (m.t === 'signal') n.sig({ t: 'signal', from: m.from, data: m.data });
      else if (m.t === 'bye') n.sig({ t: 'peer-left', id: m.id });
      else if (m.t === 'host') n.sig({ t: 'host', id: m.id });
    });
  }
  pub(t, m) { this.c?.connected && this.c.publish(this.base + t, JSON.stringify(m), { qos: 1 }); }
  signal(to, data) { this.pub('to/' + to, { t: 'signal', from: this.n.id, data }); }
  host() { this.pub('all', { t: 'host', id: this.n.id }); }
  close() { clearTimeout(this.to); this.pub('all', { t: 'bye', id: this.n.id }); setTimeout(() => this.c?.end(true), 150); }
}

export class Net {
  constructor(id, h) { Object.assign(this, { id, h, pcs: new Map(), ch: new Map(), q: new Map(), rx: new Map(), ice: [], closed: false }); }
  async connect(code, create) {
    const cfg = await fetch('config', { cache: 'no-store' }).then(r => r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null).catch(() => null);
    const managed = ICE_URL ? await fetch(ICE_URL, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null) : null;
    this.ice = managed?.iceServers?.length ? [...DEFAULT_ICE, ...managed.iceServers] : cfg?.iceServers || DEFAULT_ICE; this.code = code; this.create = create;
    this.s = cfg ? new WsSig(this) : new MqttSig(this);
  }
  sig(m) {
    if (m.t === 'error') { this.closed = true; this.s?.close(); return this.h.error(m.msg); }
    if (m.t === 'joined') { this.code = m.code; this.h.joined(m); for (const p of m.peers) if (!this.ch.has(p)) this.call(p); }
    else if (m.t === 'peer-here') { if (!this.ch.has(m.id) && !this.pcs.has(m.id)) this.call(m.id); }
    else if (m.t === 'signal') this.onSignal(m.from, m.data);
    else if (m.t === 'host') this.h.host?.(m.id);
    else if (m.t === 'peer-left') this.h.left?.(m.id);
  }
  claimHost() { this.s?.host(); }
  tx(to, data) { this.s?.signal(to, data); }
  pc(id) {
    const old = this.pcs.get(id); if (old) { this.ch.delete(id); old.onconnectionstatechange = null; old.close(); }
    const pc = new RTCPeerConnection({ iceServers: this.ice }); pc.cq = []; this.pcs.set(id, pc);
    pc.onicecandidate = e => e.candidate && this.tx(id, { c: e.candidate });
    pc.ondatachannel = e => this.bind(id, e.channel, pc);
    pc.onconnectionstatechange = () => ['failed', 'closed'].includes(pc.connectionState) && this.pcs.get(id) === pc && this.drop(id);
    return pc;
  }
  async call(id) { const pc = this.pc(id); this.bind(id, pc.createDataChannel('g'), pc); await pc.setLocalDescription(await pc.createOffer()); this.tx(id, { d: pc.localDescription }); }
  async onSignal(from, d) {
    try {
      let pc = this.pcs.get(from);
      if (d.d) {
        if (d.d.type === 'offer') pc = this.pc(from); else if (!pc || pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(d.d);
        for (const c of pc.cq.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        if (d.d.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); this.tx(from, { d: pc.localDescription }); }
      } else if (d.c && pc) pc.remoteDescription ? await pc.addIceCandidate(d.c).catch(() => {}) : pc.cq.push(d.c);
    } catch (e) { console.warn('signal', e); }
  }
  bind(id, ch, pc) {
    ch.binaryType = 'arraybuffer'; ch.bufferedAmountLowThreshold = 256 * 1024;
    ch.onopen = () => { if (this.pcs.get(id) !== pc) return; this.ch.set(id, ch); this.h.up(id); };
    ch.onclose = () => this.ch.get(id) === ch && this.drop(id);
    ch.onmessage = e => typeof e.data === 'string' ? this.json(id, JSON.parse(e.data)) : this.chunk(id, e.data);
  }
  drop(id) { const pc = this.pcs.get(id); this.pcs.delete(id); this.ch.delete(id); this.rx.delete(id); this.q.delete(id); if (pc) { pc.onconnectionstatechange = null; pc.close(); } this.h.down(id); }
  json(id, m) { if (m.t === 'ph') this.rx.set(id + m.pid, { ...m, parts: [], got: 0 }); else this.h.msg(id, m); }
  chunk(id, buf) {
    const pid = dec.decode(new Uint8Array(buf, 0, PIDLEN)).trim(), r = this.rx.get(id + pid); if (!r) return;
    r.parts.push(buf.slice(PIDLEN)); r.got += buf.byteLength - PIDLEN;
    if (r.got >= r.size) { this.rx.delete(id + pid); this.h.photo(pid, new Blob(r.parts, { type: r.type }), id); }
  }
  send(id, m) { const c = this.ch.get(id); if (c?.readyState === 'open') try { c.send(JSON.stringify(m)); } catch (e) { console.warn(e); } }
  broadcast(m) { const s = JSON.stringify(m); for (const c of this.ch.values()) if (c.readyState === 'open') try { c.send(s); } catch {} }
  // Streams a photo to each peer in 64 KB chunks, serialized per peer with backpressure
  async sendPhoto(ids, pid, blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()), head = enc.encode(pid.padEnd(PIDLEN).slice(0, PIDLEN));
    for (const id of ids) this.q.set(id, (this.q.get(id) || Promise.resolve()).then(async () => {
      const ch = this.ch.get(id); if (!ch || ch.readyState !== 'open') return;
      ch.send(JSON.stringify({ t: 'ph', pid, size: buf.length, type: blob.type }));
      for (let o = 0; o < buf.length; o += CHUNK) {
        if (ch.bufferedAmount > 1 << 20) await new Promise(r => ch.addEventListener('bufferedamountlow', r, { once: true }));
        if (ch.readyState !== 'open') return;
        const part = buf.subarray(o, o + CHUNK), out = new Uint8Array(PIDLEN + part.length); out.set(head); out.set(part, PIDLEN); ch.send(out);
      }
    }).catch(e => console.warn('photo send', e)));
  }
  close() { this.closed = true; this.s?.close(); for (const id of [...this.pcs.keys()]) { const pc = this.pcs.get(id); pc.onconnectionstatechange = null; pc.close(); } this.pcs.clear(); this.ch.clear(); }
}
