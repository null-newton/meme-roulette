# Meme Roulette helper Worker (optional)

One small Cloudflare Worker gives the static site two things it can't do alone:

- **`GET /ice`**: short-lived TURN relay credentials (Cloudflare Realtime TURN), so players on strict mobile or office networks can still connect. Credentials expire after 4 hours; the API token never reaches the browser.
- **`POST /stats`**: one anonymous record per finished game with per-card counters (dealt / played / won). No photos, names, write-ins or IP addresses are stored. Records expire after 90 days.
- **`GET /summary?token=…`**: totals per card, sorted with the least-played cards first, to find weak cards to rewrite.

The game works without it; it only adds these extras.

## Deploy (automatic)

1. In the Cloudflare dashboard: **Realtime → TURN Server → Create**. Note the *Turn Token ID* and *API Token*.
2. From the repo root:

```bash
npm run setup:worker
```

It asks for those two values, then checks them, signs you in to Cloudflare (browser) if needed, creates the KV namespace, deploys the Worker, stores the secrets, tests `/ice` and `/stats`, and writes the URLs into `public/env.js`. Commit and push `public/env.js` and `cloudflare/wrangler.toml` afterwards to go live. Safe to re-run.

## Deploy (manual)

From this folder:

```bash
npx wrangler login
npx wrangler kv namespace create STATS
```

3. Paste the printed KV `id` into `wrangler.toml`, then:

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_KEY_API_TOKEN
npx wrangler secret put SUMMARY_TOKEN
npx wrangler deploy
```

4. Put the Worker URL in `public/env.js`:

```js
export const ICE_URL = 'https://meme-roulette-api.<your-subdomain>.workers.dev/ice';
export const STATS_URL = 'https://meme-roulette-api.<your-subdomain>.workers.dev/stats';
```

TURN traffic is billed by Cloudflare after the free allowance (1,000 GB/month at the time of writing). Only players with no direct path use it.
