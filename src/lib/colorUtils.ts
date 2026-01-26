import type { CSSProperties } from 'react'

export const BASE_LEVEL_0_CLASS =
    'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/40 dark:border-zinc-700/60'

export const DYNAMIC_CELL_CLASS =
    'bg-[var(--cell-bg)] dark:bg-[var(--cell-bg-dark)] border-[var(--cell-border)] dark:border-[var(--cell-border-dark)] border'

export function getYearHue(year: number): number {
    // Start from emerald (160) in 2014, rotate 20 degrees per year
    return (160 + (year - 2014) * 20) % 360
}

export function getLevelStyle(year: number, level: number): CSSProperties {
    if (level <= 0) return {}

    const hue = getYearHue(year)
    const s = 75

    // Light: L, A | Dark: L, A
    let lL, lA, dL, dA

    switch (level) {
        case 1: // ~200 / ~950
            lL = 90; lA = 1
            dL = 10; dA = 0.5
            break
        case 2: // ~300 / ~900
            lL = 80; lA = 1
            dL = 15; dA = 0.7
            break
        case 3: // ~400 / ~800
            lL = 60; lA = 1
            dL = 30; dA = 1
            break
        case 4: // ~400 / ~800
            lL = 45; lA = 1
            dL = 50; dA = 1
            break
        default:
            return {}
    }

    return {
        '--cell-bg': `hsla(${hue}, ${s}%, ${lL}%, ${lA})`,
        '--cell-bg-dark': `hsla(${hue}, ${s}%, ${dL}%, ${dA})`,
        '--cell-border': `hsla(${hue}, ${s}%, ${lL}%, 0.7)`,
        // Make dark mode border lighter (dL + 15%) so it stands out against the background
        '--cell-border-dark': `hsla(${hue}, ${s}%, ${Math.min(dL + 15, 90)}%, 0.5)`,
    } as CSSProperties
}
