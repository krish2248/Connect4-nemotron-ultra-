const THEME_KEY = 'connect4_theme';

// Every theme maps CSS custom properties onto <html> as inline styles.
// 'classic' is the built-in palette defined in main.css — applying it just
// clears any overrides.
export const THEMES = {
  classic: {
    name: 'Classic Dark',
    swatch: ['#18181b', '#fbbf24', '#f87171'],
    vars: {}
  },
  midnight: {
    name: 'Midnight Blue',
    swatch: ['#0b1020', '#38bdf8', '#f87171'],
    vars: {
      '--bg': '#0b1020',
      '--surface': '#131a2e',
      '--surface-elevated': '#1c2742',
      '--border': '#2e3d5f',
      '--text': '#e8edf7',
      '--text-muted': '#8ea0bf',
      '--accent': '#38bdf8',
      '--accent-dim': '#0284c7',
      '--frame-grad-top': '#141d36',
      '--frame-grad-bottom': '#0a1122',
      '--hole-c1': '#141d36',
      '--hole-c2': '#0a1122',
      '--hole-c3': '#060b18'
    }
  },
  forest: {
    name: 'Forest Green',
    swatch: ['#0d1a12', '#34d399', '#fb7185'],
    vars: {
      '--bg': '#0d1a12',
      '--surface': '#14241a',
      '--surface-elevated': '#1d3226',
      '--border': '#2f4a39',
      '--text': '#eef7f0',
      '--text-muted': '#9dbfa8',
      '--red': '#fb7185',
      '--red-dim': '#e11d48',
      '--red-glow': '#fda4af',
      '--accent': '#34d399',
      '--accent-dim': '#059669',
      '--frame-grad-top': '#16281d',
      '--frame-grad-bottom': '#0b160f',
      '--hole-c1': '#16281d',
      '--hole-c2': '#0b160f',
      '--hole-c3': '#060d09'
    }
  },
  sunset: {
    name: 'Sunset Purple',
    swatch: ['#1a1023', '#e879f9', '#fb7185'],
    vars: {
      '--bg': '#1a1023',
      '--surface': '#241731',
      '--surface-elevated': '#332044',
      '--border': '#4d3364',
      '--text': '#faf0ff',
      '--text-muted': '#b79dd1',
      '--yellow': '#fcd34d',
      '--yellow-glow': '#fde68a',
      '--red': '#fb7185',
      '--red-dim': '#e11d48',
      '--red-glow': '#fda4af',
      '--accent': '#e879f9',
      '--accent-dim': '#c026d3',
      '--frame-grad-top': '#2c1c3d',
      '--frame-grad-bottom': '#170e21',
      '--hole-c1': '#2c1c3d',
      '--hole-c2': '#170e21',
      '--hole-c3': '#0e0815',
      '--win-glow': 'rgba(232, 121, 249, 0.35)'
    }
  },
  neon: {
    name: 'Neon Arcade',
    swatch: ['#050510', '#ccff00', '#ff2ec4'],
    vars: {
      '--bg': '#050510',
      '--surface': '#0b0b1a',
      '--surface-elevated': '#15152b',
      '--border': '#2a2a4a',
      '--text': '#eafff6',
      '--text-muted': '#7f93b8',
      '--yellow': '#ccff00',
      '--yellow-dim': '#a3cc00',
      '--yellow-glow': '#e2ff66',
      '--red': '#ff2ec4',
      '--red-dim': '#c40f92',
      '--red-glow': '#ff7ada',
      '--accent': '#00ffd5',
      '--accent-dim': '#00c9a7',
      '--frame-grad-top': '#10102a',
      '--frame-grad-bottom': '#070716',
      '--hole-c1': '#10102a',
      '--hole-c2': '#070716',
      '--hole-c3': '#03030b',
      '--win-glow': 'rgba(204, 255, 0, 0.3)'
    }
  },
  light: {
    name: 'Daylight',
    swatch: ['#f4f4f5', '#d97706', '#dc2626'],
    vars: {
      '--bg': '#f4f4f5',
      '--surface': '#ffffff',
      '--surface-elevated': '#e9e9ee',
      '--border': '#d4d4d8',
      '--text': '#18181b',
      '--text-muted': '#52525b',
      '--yellow': '#d97706',
      '--yellow-dim': '#b45309',
      '--yellow-glow': '#f59e0b',
      '--red': '#dc2626',
      '--red-dim': '#b91c1c',
      '--red-glow': '#ef4444',
      '--shadow': '0 4px 24px rgba(0,0,0,0.12)',
      '--shadow-coin': '0 8px 20px rgba(0,0,0,0.18)',
      '--frame-grad-top': '#ececf2',
      '--frame-grad-bottom': '#d6d6df',
      '--hole-c1': '#e2e2ea',
      '--hole-c2': '#cfcfda',
      '--hole-c3': '#bcbcc9',
      '--coin-yellow-edge': '#92510a',
      '--coin-red-edge': '#8f1616',
      '--win-glow': 'rgba(217, 119, 6, 0.3)'
    }
  }
};

const KNOWN_VARS = [
  ...new Set(
    Object.values(THEMES).flatMap(t => Object.keys(t.vars))
  )
];

function currentThemeId() {
  const id = localStorage.getItem(THEME_KEY);
  return THEMES[id] ? id : 'classic';
}

function applyTheme(id) {
  const theme = THEMES[id];
  if (!theme) return false;

  const root = document.documentElement;
  // Clear previous overrides so switching back to classic is clean.
  KNOWN_VARS.forEach(v => root.style.removeProperty(v));
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));

  root.dataset.theme = id;
  localStorage.setItem(THEME_KEY, id);
  return true;
}

export class ThemeManager {
  constructor() {
    this.id = currentThemeId();
    applyTheme(this.id);
  }

  get current() {
    return this.id;
  }

  set(id) {
    if (!THEMES[id] || !applyTheme(id)) return;
    this.id = id;
  }

  list() {
    return Object.entries(THEMES).map(([id, t]) => ({
      id,
      name: t.name,
      swatch: t.swatch,
      active: id === this.id
    }));
  }
}
