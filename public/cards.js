// Caption decks live in versioned JSON (decks/*.json) so cards can be fixed or added without an app release.
// Each card: { id, text, rating: family|standard|spicy, pack, lang }. Only the host needs the deck; card text travels in game state.
export const DECK = { id: null, version: 0, cards: [], byId: new Map() };
export const RATINGS = { family: ['family'], standard: ['family', 'standard'], spicy: ['family', 'standard', 'spicy'] };
export function setDeck(d) { Object.assign(DECK, { id: d.id, version: d.version, cards: d.cards, byId: new Map(d.cards.map(c => [c.id, c])) }); return DECK; }
// Fetches the latest deck (network first via the service worker, cached copy when offline)
export async function loadDeck(url = 'decks/base.json') {
  const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('deck ' + r.status);
  return setDeck(await r.json());
}
export const deckIds = rating => DECK.cards.filter(c => RATINGS[rating]?.includes(c.rating)).map(c => c.id);
