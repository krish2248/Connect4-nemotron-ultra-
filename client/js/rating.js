const RATINGS_KEY = 'connect4_ratings';
const DEFAULT_RATING = 1000;

export const RANKS = [
  { min: 1500, name: 'Diamond', color: '#67e8f9' },
  { min: 1300, name: 'Platinum', color: '#a5b4fc' },
  { min: 1100, name: 'Gold', color: '#fbbf24' },
  { min: 900, name: 'Silver', color: '#d4d4d8' },
  { min: 0, name: 'Bronze', color: '#d97706' }
];

export class Rating {
  static loadAll() {
    try {
      return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  static saveAll(all) {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(all));
  }

  static normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  static get(name) {
    const all = this.loadAll();
    return all[this.normalizeName(name)] ?? DEFAULT_RATING;
  }

  static set(name, value) {
    if (!Number.isFinite(value)) return;
    const all = this.loadAll();
    all[this.normalizeName(name)] = Math.max(100, Math.min(3000, Math.round(value)));
    this.saveAll(all);
  }

  // Apply a server-computed Elo update for this player.
  static applyUpdate(name, elo) {
    if (!elo || !Number.isFinite(elo.new)) return null;
    this.set(name, elo.new);
    return elo;
  }

  static rankFor(rating) {
    return RANKS.find(r => rating >= r.min) || RANKS[RANKS.length - 1];
  }

  static formatDelta(delta) {
    if (!Number.isFinite(delta) || delta === 0) return '±0';
    return delta > 0 ? `+${delta}` : `${delta}`;
  }
}
