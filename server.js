// Meme Roulette: static PWA host + stateless WebRTC signaling. Never sees game data or photos.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const PORT = +process.env.PORT || 8080, PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const ICE = process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

function serve(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/config' && !process.env.STATIC_ONLY) return res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }), res.end(JSON.stringify({ iceServers: ICE }));
  const p = path.normalize(path.join(PUB, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)));
  if (!p.startsWith(PUB)) return res.writeHead(403), res.end();
  fs.readFile(p, (e, d) => e ? (res.writeHead(404), res.end('Not found')) : (res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }), res.end(d)));
}
const server = process.env.CERT ? https.createServer({ cert: fs.readFileSync(process.env.CERT), key: fs.readFileSync(process.env.KEY) }, serve) : http.createServer(serve);

const rooms = new Map(), ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', MAX = 10;
const newCode = () => { let c; do c = Array.from({ length: 6 }, () => ABC[Math.random() * ABC.length | 0]).join(''); while (rooms.has(c)); return c; };
const tx = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', ws => {
  ws.alive = true; ws.on('pong', () => ws.alive = true);
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create' || m.t === 'join') {
      if (typeof m.id !== 'string' || !m.id || m.id.length > 40) return;
      const c = m.t === 'create' ? newCode() : String(m.code || '').toUpperCase();
      let r = rooms.get(c);
      if (m.t === 'create') rooms.set(c, r = { host: m.id, peers: new Map() });
      if (!r) return tx(ws, { t: 'error', msg: 'Room not found' });
      if (!r.peers.has(m.id) && r.peers.size >= MAX) return tx(ws, { t: 'error', msg: 'Room is full (10 players)' });
      clearTimeout(r.gc);
      const old = r.peers.get(m.id); if (old && old !== ws) { old.room = null; old.close(); }
      r.peers.set(m.id, ws); ws.room = c; ws.id = m.id;
      tx(ws, { t: 'joined', code: c, host: r.host, peers: [...r.peers.keys()].filter(i => i !== m.id) });
      for (const [i, p] of r.peers) if (i !== m.id) tx(p, { t: 'peer-joined', id: m.id });
      return;
    }
    const r = rooms.get(ws.room); if (!r) return;
    if (m.t === 'signal') { const p = r.peers.get(m.to); p && tx(p, { t: 'signal', from: ws.id, data: m.data }); }
    else if (m.t === 'host') { r.host = ws.id; for (const p of r.peers.values()) tx(p, { t: 'host', id: ws.id }); }
  });
  ws.on('close', () => {
    const r = rooms.get(ws.room); if (!r || r.peers.get(ws.id) !== ws) return;
    r.peers.delete(ws.id);
    for (const p of r.peers.values()) tx(p, { t: 'peer-left', id: ws.id });
    if (!r.peers.size) { const c = ws.room; r.gc = setTimeout(() => rooms.delete(c), 120000); }
  });
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 20000);

server.listen(PORT, () => {
  const ips = Object.values(require('os').networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  const proto = process.env.CERT ? 'https' : 'http';
  console.log(`Meme Roulette running:\n  ${proto}://localhost:${PORT}\n${ips.map(ip => `  ${proto}://${ip}:${PORT}`).join('\n')}`);
});
