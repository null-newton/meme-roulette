# Meme Roulette

A party game for phones: every round shows a real photo from one player's camera roll on every phone, everyone plays their funniest caption card, and the judge crowns a winner. Built from the *What Do You Meme — Mobile Edition* game design document; see [ROADMAP.md](ROADMAP.md) for how the GDD was split into phases and what this build covers.

This is **phase 1: the installable web app (PWA)**. Phones connect directly to each other with WebRTC; the host's phone runs the game; photos travel phone to phone and are never stored on a server.

## Run it

```bash
npm install
npm start
```

The server prints its addresses. Open `http://localhost:8080` on this computer, and `http://<your-LAN-IP>:8080` on phones on the same Wi-Fi.

- **HTTPS** (needed for install-to-home-screen, the share sheet and the service worker on phones): `CERT=cert.pem KEY=key.pem npm start`, or put it behind any HTTPS tunnel/reverse proxy.
- **TURN relay** for strict mobile/corporate networks: `ICE_SERVERS='[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]' npm start`.
- `PORT` changes the port (default 8080).

## Hosting

**Live:** https://meme.zacsvae.com (GitHub Pages, deployed from `public/` by `.github/workflows/pages.yml` on every push to `main`).

GitHub Pages only serves static files, so there the app signals through a public MQTT broker (`broker.emqx.io`, set in `public/net.js`) instead of `server.js`. The app picks this automatically when `config` isn't available. The broker only relays connection offers; game state and photos go phone to phone over encrypted WebRTC. Run `STATIC_ONLY=1 npm start` to test that mode locally.

## How to play

1. One player taps **Create game** and shares the code, link or QR code. Everyone else joins (3–10 players).
2. Each player picks photos from their phone (or joins caption-only). Photos are resized, re-encoded and stripped of location data on the phone.
3. The host picks a mode (Classic, Roulette, Crowd vote, Write-in, Speed) and settings, then starts.
4. Each round: a photo appears, everyone except the judge plays a card (tap to preview, tap again to play), the judge swipes through anonymous captions and crowns one. In Roulette, guess whose photo it is for +1.
5. First to the target score wins. Long-press any photo to report it, hide it, or remove your own.

## Files

| File | What it does |
| --- | --- |
| `server.js` | Serves the app and runs signaling (room codes → peers, relays WebRTC offers). Sees no game data or photos. |
| `public/net.js` | WebRTC mesh: one data channel per peer, JSON messages + photos in 64 KB chunks with backpressure. |
| `public/engine.js` | Host-authoritative game engine (draws, deals, timers, scoring, modes). Any peer can run it after host migration. |
| `public/app.js` | Screens, client logic, host takeover, reconnects, photo sharing, save-meme consent. |
| `public/photos.js` | On-device photo filtering, resizing, WebP/JPEG encoding, saved stash (IndexedDB), meme rendering. |
| `public/cards.js` | 400 original captions tagged Family / Standard / Spicy. |
| `public/sw.js`, `manifest.webmanifest`, `icon.svg` | PWA shell. |

## Testing on one computer

Open several browser tabs at `http://localhost:8080` (each tab is its own player) and join the same room code. Closing the host's tab mid-game hands the game to the longest-connected player after ~10 s.
