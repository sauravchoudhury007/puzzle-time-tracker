import type { CSSProperties } from 'react'

/* The per-year hue ramp: every year of solving gets its own colour, rotating
   20° from emerald in 2014. Four levels within a year go from pale to saturated
   as solves get faster. Used by the activity grid and the Frame poster —
   Pulse's lime accent stays for the live, single-value surfaces. */

const SATURATION = 75

export function getYearHue(year: number): number {
  return (160 + (year - 2014) * 20) % 360
}

type Shade = { lightness: number; alpha: number }

const LIGHT_SHADES: Record<number, Shade> = {
  1: { lightness: 90, alpha: 1 },
  2: { lightness: 80, alpha: 1 },
  3: { lightness: 60, alpha: 1 },
  4: { lightness: 45, alpha: 1 },
}

const DARK_SHADES: Record<number, Shade> = {
  1: { lightness: 10, alpha: 0.5 },
  2: { lightness: 15, alpha: 0.7 },
  3: { lightness: 30, alpha: 1 },
  4: { lightness: 50, alpha: 1 },
}

/** Fill colour for one cell. `scheme` is the surface it sits on, not the app theme. */
export function yearCellColor(year: number, level: number, scheme: 'light' | 'dark'): string {
  const shade = (scheme === 'dark' ? DARK_SHADES : LIGHT_SHADES)[level]
  if (!shade) return 'transparent'
  return `hsla(${getYearHue(year)}, ${SATURATION}%, ${shade.lightness}%, ${shade.alpha})`
}

/** Hairline around a cell — lighter than the fill in dark so it still reads. */
export function yearCellBorder(year: number, level: number, scheme: 'light' | 'dark'): string {
  const shade = (scheme === 'dark' ? DARK_SHADES : LIGHT_SHADES)[level]
  if (!shade) return 'transparent'
  const lightness = scheme === 'dark' ? Math.min(shade.lightness + 15, 90) : shade.lightness
  return `hsla(${getYearHue(year)}, ${SATURATION}%, ${lightness}%, ${scheme === 'dark' ? 0.5 : 0.7})`
}

/**
 * Both schemes as custom properties, so the cell can follow the app's
 * light/dark toggle in CSS instead of waiting for JS to know the mode.
 * Paired with the `.hm-year` rules in globals.css.
 */
export function yearCellVars(year: number, level: number): CSSProperties {
  if (level <= 0) return {}
  return {
    '--c-l': yearCellColor(year, level, 'light'),
    '--c-d': yearCellColor(year, level, 'dark'),
    '--c-bl': yearCellBorder(year, level, 'light'),
    '--c-bd': yearCellBorder(year, level, 'dark'),
  } as CSSProperties
}
