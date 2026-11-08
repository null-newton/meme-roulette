// Meme Roulette stats Worker (Cloudflare free plan). POST /stats: one anonymous record per game.
// GET /summary?token=...: totals per card (dealt / played / won / win rate). Never receives photos, names or write-in text.
const json = (b, h = {}, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...h } });
const int = v => Number.isInteger(v) && v >= 0 && v < 1000 ? v : 0;

export default {
  async fetch(req, env) {
    const u = new URL(req.url), origin = req.headers.get('origin') || '', allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
    const cors = { 'access-control-allow-origin': allowed ? origin : 'null', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (u.pathname === '/summary' && req.method === 'GET') {
      if (!env.SUMMARY_TOKEN || u.searchParams.get('token') !== env.SUMMARY_TOKEN) return json({ error: 'forbidden' }, {}, 403);
      const tot = {}; let games = 0, cursor;
      do {
        const page = await env.STATS.list({ prefix: 'game:', cursor }); cursor = page.list_complete ? null : page.cursor;
        for (const k of page.keys) {
          const g = await env.STATS.get(k.name, 'json'); if (!g) continue; games++;
          for (const [id, c] of Object.entries(g.cards)) { const t = tot[id] ||= { dealt: 0, played: 0, won: 0 }; t.dealt += c.dealt; t.played += c.played; t.won += c.won; }
        }
      } while (cursor);
      const cards = Object.entries(tot).map(([id, t]) => ({ id, ...t, winRate: t.played ? +(t.won / t.played).toFixed(3) : 0, playRate: t.dealt ? +(t.played / t.dealt).toFixed(3) : 0 })).sort((a, b) => a.playRate - b.playRate);
      return json({ games, cards });
    }
    if (!allowed) return json({ error: 'forbidden' }, cors, 403);

    if (u.pathname === '/stats' && req.method === 'POST') {
      const raw = await req.text(); if (raw.length > 64 * 1024) return json({ error: 'too large' }, cors, 413);
      let b; try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, cors, 400); }
      if (b?.v !== 1 || typeof b.deck !== 'string' || typeof b.cards !== 'object') return json({ error: 'bad shape' }, cors, 400);
      const cards = {};
      for (const [id, c] of Object.entries(b.cards).slice(0, 500)) if (/^[a-z0-9-]{1,32}$/.test(id) && c) cards[id] = { dealt: int(c.dealt), played: int(c.played), won: int(c.won) };
      await env.STATS.put(`game:${new Date().toISOString().slice(0, 10)}:${crypto.randomUUID()}`, JSON.stringify({ deck: b.deck.slice(0, 40), mode: String(b.mode || '').slice(0, 12), cards }), { expirationTtl: 90 * 86400 });
      return json({ ok: true }, cors);
    }
    return json({ error: 'not found' }, cors, 404);
  },
};
