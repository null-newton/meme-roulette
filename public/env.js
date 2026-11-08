// Optional services. Leave empty to disable. See cloudflare/README.md for the Worker that provides both.
// ICE_URL: GET returns { iceServers } with short-lived TURN credentials, so players on strict networks can still connect.
// STATS_URL: receives anonymous per-card counters (dealt / played / won) at the end of each game. Never photos, names or write-ins.
export const ICE_URL = '';
export const STATS_URL = '';
