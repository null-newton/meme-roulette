// On-device photo prep: filter, resize to 1080 px, re-encode (strips EXIF/GPS), and a device-only saved stash.
const MAX = 1080, SHOT = /screenshot|screen shot|screen_shot|scr_\d|bildschirmfoto|capture d.?(é|e)cran|schermafbeelding/i;
export const eligible = f => f.type.startsWith('image/') && !SHOT.test(f.name);
const loadImg = f => new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(f); i.onload = () => (URL.revokeObjectURL(u), res(i)); i.onerror = rej; i.src = u; });
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
export async function processFile(f) {
  const img = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => loadImg(f));
  const w0 = img.width, h0 = img.height, k = Math.min(1, MAX / Math.max(w0, h0)), w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); img.close?.();
  let b = await toBlob(c, 'image/webp', 0.75);
  if (!b || b.type !== 'image/webp') b = await toBlob(c, 'image/jpeg', 0.8);
  return b;
}
// Processes picked files in order, skipping screenshots, videos and undecodable files
export async function processFiles(files, onProgress) {
  const ok = [...files].filter(eligible), out = []; let skipped = files.length - ok.length;
  for (let i = 0; i < ok.length; i++) { try { out.push(await processFile(ok[i])); } catch { skipped++; } onProgress?.(i + 1, ok.length); }
  return { blobs: out, skipped };
}
// On-device nudity classifier (NSFWJS MobileNetV2, self-hosted, lazy-loaded only when picking photos)
let nsfw;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
export const loadNsfw = () => nsfw ||= (async () => { const b = 'vendor/nsfwjs/'; await loadScript(b + 'model.min.js'); await loadScript(b + 'group1-shard1of1.min.js'); await loadScript(b + 'nsfwjs.min.js'); return window.nsfwjs.load('MobileNetV2'); })().catch(e => { nsfw = null; throw e; });
export const isFlagged = s => (s.Porn || 0) + (s.Hentai || 0) >= 0.5 || (s.Sexy || 0) >= 0.9;
// Returns class probabilities ({Neutral, Drawing, Sexy, Porn, Hentai}) for one photo
export async function nsfwScores(blob) {
  const m = await loadNsfw(), img = await createImageBitmap(blob), c = document.createElement('canvas');
  c.width = c.height = 224; c.getContext('2d').drawImage(img, 0, 0, 224, 224); img.close?.();
  return Object.fromEntries((await m.classify(c, 5)).map(p => [p.className, p.probability]));
}
// Flags each blob; returns null when the classifier can't load (e.g. offline on first use)
export async function flagAll(blobs, onProgress) {
  try { await loadNsfw(); } catch { return null; }
  const out = [];
  for (let i = 0; i < blobs.length; i++) { try { out.push(isFlagged(await nsfwScores(blobs[i]))); } catch { out.push(false); } onProgress?.(i + 1, blobs.length); }
  return out;
}
const db = () => new Promise((res, rej) => { const r = indexedDB.open('meme-roulette', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export async function saveStash(blobs) { try { const d = await db(); d.transaction('kv', 'readwrite').objectStore('kv').put(blobs, 'stash'); } catch {} }
export async function loadStash() { try { const d = await db(); return await new Promise(r => { const q = d.transaction('kv').objectStore('kv').get('stash'); q.onsuccess = () => r(q.result || []); q.onerror = () => r([]); }); } catch { return []; } }
export async function clearStash() { try { const d = await db(); d.transaction('kv', 'readwrite').objectStore('kv').delete('stash'); } catch {} }
// Renders photo + caption into a classic meme JPEG for saving
export async function memeBlob(blob, text) {
  const img = await createImageBitmap(blob), c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = img.width; c.height = img.height; g.drawImage(img, 0, 0);
  const fs = Math.round(Math.min(c.width / 10, c.height / 8)), lh = fs * 1.08, maxW = c.width * 0.92;
  g.font = `${fs}px Anton, Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = fs / 6; g.strokeStyle = '#000'; g.fillStyle = '#fff';
  const lines = []; let line = '';
  for (const w of text.toUpperCase().split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  let y = c.height - fs * 0.4 - (lines.length - 1) * lh;
  for (const l of lines) { g.strokeText(l, c.width / 2, y); g.fillText(l, c.width / 2, y); y += lh; }
  g.font = `${Math.round(fs / 3)}px system-ui, sans-serif`; g.textAlign = 'right'; g.globalAlpha = 0.6; g.lineWidth = 3;
  g.strokeText('Meme Roulette', c.width - 10, fs / 2.4); g.fillText('Meme Roulette', c.width - 10, fs / 2.4);
  return toBlob(c, 'image/jpeg', 0.9);
}
