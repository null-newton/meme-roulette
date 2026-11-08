# Meme Roulette stats Worker (optional)

A small Cloudflare Worker on the **free plan** (no payment card needed) that collects anonymous caption-card stats:

- **`POST /stats`**: one record per finished game with per-card counters (dealt / played / won). No photos, names, write-ins or IP addresses are stored. Records expire after 90 days.
- **`GET /summary?token=…`**: totals per card, least-played first, to find weak cards to rewrite.

The game works without it.

## Deploy

From the repo root:

```bash
npm run setup:worker
```

It asks nothing. It signs you in to Cloudflare (browser) if needed, creates the KV namespace, deploys the Worker, stores a random summary token, tests `/stats`, and writes the URL into `public/env.js`. Then commit and push `public/env.js` and `cloudflare/wrangler.toml` to go live. Safe to re-run.

The summary link is printed at the end; its token is saved in `cloudflare/summary-token.txt` (ignored by git).
