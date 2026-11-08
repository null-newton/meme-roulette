# Meme Roulette — build roadmap

The game design document is too large to build in one go, so it is split into phases. Each phase is playable on its own and builds on the previous one.

## Phase 1 — Playable PWA core (this build) ✅

Goal of the GDD's MVP: friends laugh at captions on each other's real photos. Everything runs in the browser, so any phone can join from a link.

| GDD section | What is built |
| --- | --- |
| Lobby & multiplayer | 6-character room codes (no 0/O/1/I), share link, QR code, nickname + avatar, no account, 3–10 players, status chips, host settings, kick, start at 3 ready |
| Connections | Signaling server (`server.js`) that only maps codes and relays offers; WebRTC data channels: game state as a star to the host, photos as a full mesh; STUN by default, TURN via `ICE_SERVERS` env var |
| Host authority | Host's phone draws photos, deals, runs timers and scores, mirrors full state to every peer after each event |
| Host migration & reconnects | Host gone > 10 s → longest-connected peer takes over from its mirror; 60 s to rejoin and keep hand, score and photos; a reloaded host recovers state from peers |
| Photo sourcing (PWA) | Hand-pick via the browser picker and Saved stash (IndexedDB, on-device only); preview grid, tap to drop, re-roll; screenshots and videos skipped; resize to 1080 px, WebP q75 (JPEG on Safari), EXIF/GPS stripped by re-encoding |
| Photo sharing | Photos stay home until drawn; owner streams them in 64 KB chunks to every phone; next 2 photos prefetched; synced reveal 1.5 s ahead; host forwards a cached copy if the owner is offline; caches wiped on leave and when a player/photo is removed |
| Core loop & rules | Balanced photo draw with no repeats, 7-card hands that refill, hand swap, caption timer, anonymous judging with swipe + crown, judge timeout → everyone votes, +1 per win, target score or fixed rounds |
| Modes | Classic, Roulette (whose photo? +1), Crowd vote, Write-in, Speed |
| Settings | All settings in the GDD table, including the spicy-deck 18+ confirmation |
| Screens | All 10 core screens (home, join, lobby, photo picker, preview, player round, judge round, judging, result, game over with best-of reel and rematch) |
| Captions | ~400 original captions tagged Family / Standard / Spicy; dealt without repeats per game |
| Safety | Age gate, long-press Report / Hide for me / Remove from game, 3 reports removes a photo, host kick, write-ins limited to 80 chars with profanity masking and slur blocking, saving a meme asks the owner (10 s, no answer = no) |
| PWA shell | Manifest, service worker (app shell cached), install button on Android, Add-to-Home-Screen how-to on iOS, haptics where supported |

Not in phase 1: the on-device nudity classifier (needs a TensorFlow.js/ONNX model — phase 2).

## Phase 2 — Safety and polish

- On-device nudity check on the preview screen (TensorFlow.js or ONNX Runtime Web), extra confirmation, blocked with Family/Standard decks.
- Workbox-based service worker, deck JSON served from a CDN with versioning.
- Anonymous card stats (wins / never played) with no photo or write-in text.
- Managed TURN credentials (Cloudflare/Twilio) issued by the signaling server.
- Privacy policy page and published contact (store UGC requirement).

## Phase 3 — Native apps (Expo / React Native)

- Port screens and the shared engine (`engine.js`) to an Expo app; react-native-webrtc behind the same transport interface as `net.js`.
- Album and Surprise-me photo sources with the permission explainer.
- Apple SensitiveContentAnalysis / TF Lite nudity check, screenshot toasts, background grace period.
- Store listings, 17+ rating, age gate.

## Phase 4 — Monetization

- Caption packs (host owns → whole room uses), Party Pass (all packs, write-ins, 16-player rooms, custom decks), cosmetics.
- RevenueCat in native apps, Stripe web checkout + sign-in in the PWA.
- One skippable ad between games for free hosts.

## Phase 5 — Growth

- Best-of reel sharing with owner consent, rematch stats.
- More languages (captions written per language) and expanded Spicy deck.

## Open questions from the GDD (decisions taken for phase 1)

- Owner hidden by default? → Classic shows the owner after judging; Roulette hides it until the result.
- Can the judge's own photo come up? → Yes; the judge can't guess it and there's no bonus.
- Remote play over mobile data? → Works with STUN; TURN is opt-in via `ICE_SERVERS`.
