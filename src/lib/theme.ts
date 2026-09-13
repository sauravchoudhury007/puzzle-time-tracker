// Pulse — the design system this app is built on.
// Bold data-driven, chunky type, electric lime accent.
//
// These tokens are the single source of truth. They are emitted as CSS custom
// properties by `themeCss()` (rendered into <head> by the root layout), so every
// component — including SVG charts — can read them with var(--token) and stay in
// sync with light/dark without any JS.

export type ThemeMode = 'light' | 'dark'

type Tokens = {
  bg: string
  surface: string
  surface2: string
  ink: string
  muted: string
  rule: string
  ruleSoft: string
  accent: string
  accent2: string
  positive: string
  negative: string
  /** 5-stop heatmap ramp, index 0 = empty cell, 4 = fastest */
  heatmap: [string, string, string, string, string]
  cellRadius: string
  cardRadius: string
}

export const PULSE_LIGHT: Tokens = {
  bg: '#f6f6f4',
  surface: '#ffffff',
  surface2: '#eeede9',
  ink: '#0c0c0a',
  muted: '#6a6a64',
  rule: '#0c0c0a',
  ruleSoft: 'rgba(12,12,10,.12)',
  accent: '#9bd400',
  accent2: '#0c0c0a',
  positive: '#0c0c0a',
  negative: '#e23030',
  heatmap: ['#e8e8e3', '#cfe46b', '#a9d420', '#7aa600', '#3f5600'],
  cellRadius: '2px',
  cardRadius: '10px',
}

export const PULSE_DARK: Tokens = {
  bg: '#0b0b09',
  surface: '#141412',
  surface2: '#1d1d1a',
  ink: '#f3f3ee',
  muted: '#8a8a80',
  rule: '#f3f3ee',
  ruleSoft: 'rgba(243,243,238,.14)',
  accent: '#c4f019',
  accent2: '#f3f3ee',
  positive: '#c4f019',
  negative: '#ff6155',
  heatmap: ['#1d1d1a', '#3d4a16', '#74921e', '#a9d420', '#dcff5a'],
  cellRadius: '2px',
  cardRadius: '10px',
}

export const MODE_STORAGE_KEY = 'pulse-mode'

function declarations(t: Tokens): string {
  return [
    `--bg:${t.bg}`,
    `--surface:${t.surface}`,
    `--surface2:${t.surface2}`,
    `--ink:${t.ink}`,
    `--muted:${t.muted}`,
    `--rule:${t.rule}`,
    `--rule-soft:${t.ruleSoft}`,
    `--accent:${t.accent}`,
    `--accent2:${t.accent2}`,
    `--positive:${t.positive}`,
    `--negative:${t.negative}`,
    ...t.heatmap.map((c, i) => `--hm-${i}:${c}`),
    `--cell-r:${t.cellRadius}`,
    `--card-r:${t.cardRadius}`,
  ].join(';')
}

/**
 * Light is the default. Dark applies when the reader has explicitly chosen it,
 * or when the OS prefers dark and they have not chosen light.
 */
export function themeCss(): string {
  const light = declarations(PULSE_LIGHT)
  const dark = declarations(PULSE_DARK)
  return [
    `:root{${light}}`,
    `:root[data-mode="dark"]{${dark}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-mode="light"]){${dark}}}`,
  ].join('')
}

/**
 * Runs before first paint so a stored preference never flashes the other theme.
 */
export const MODE_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  MODE_STORAGE_KEY
)});if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-mode',m)}}catch(e){}})()`
