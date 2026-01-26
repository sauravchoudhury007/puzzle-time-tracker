'use client'

import React, { useEffect, useState } from 'react'
import { DYNAMIC_CELL_CLASS, getLevelStyle } from '@/lib/colorUtils'

export default function ColorsPage() {
    const [mounted, setMounted] = useState(false)
    const startYear = 2014
    const endYear = 2035
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)

    // Use state for random values to avoid hydration mismatch
    const [data, setData] = useState<{ year: number; levels: number[] }[]>([])

    useEffect(() => {
        setMounted(true)
        const newData = years.map((year) => ({
            year,
            // Generate 20 random levels (1-4) for each year to avoid grey blocks
            levels: Array.from({ length: 20 }, () => Math.floor(Math.random() * 4) + 1),
        }))
        setData(newData)
    }, []) // Run once on mount

    if (!mounted) return null

    return (
        <main className="min-h-screen p-8 bg-[#050b1c] text-white space-y-12">
            <section>
                <h1 className="text-3xl font-bold mb-8">Color Visualization (2014-2035) Continuous Block</h1>

                {/* One continuous container */}
                <div className="flex flex-wrap gap-1 max-w-6xl mx-auto p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.4)]">
                    {data.map(({ year, levels }) => (
                        <React.Fragment key={year}>
                            {/* Year Marker */}
                            <div className="h-4 px-1 flex items-center justify-center text-[10px] font-mono text-white/50 select-none bg-white/5 rounded-sm ml-1 first:ml-0">
                                {year}
                            </div>

                            {/* Cells for this year */}
                            {levels.map((level, i) => {
                                const style = getLevelStyle(year, level)
                                const cellClass = level > 0 ? DYNAMIC_CELL_CLASS : 'bg-zinc-800 border border-zinc-700/60'

                                return (
                                    <div
                                        key={`${year}-${i}`}
                                        className={`h-4 w-4 rounded-sm transition-opacity hover:opacity-80 ${cellClass}`}
                                        style={style}
                                        title={`${year} - Level ${level}`}
                                    />
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </section>

            <section>
                <h1 className="text-3xl font-bold mb-8">Year by Year Row View</h1>

                <div className="flex flex-col gap-4 max-w-6xl mx-auto p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.4)]">
                    {data.map(({ year, levels }) => (
                        <div key={year} className="flex items-center gap-4">
                            {/* Year Label */}
                            <div className="w-12 text-sm font-mono text-white/70">
                                {year}
                            </div>

                            {/* Cells row */}
                            <div className="flex flex-wrap gap-1">
                                {levels.map((level, i) => {
                                    const style = getLevelStyle(year, level)
                                    const cellClass = level > 0 ? DYNAMIC_CELL_CLASS : 'bg-zinc-800 border border-zinc-700/60'

                                    return (
                                        <div
                                            key={`${year}-${i}`}
                                            className={`h-4 w-4 rounded-sm transition-opacity hover:opacity-80 ${cellClass}`}
                                            style={style}
                                            title={`${year} - Level ${level}`}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h1 className="text-3xl font-bold mb-8">Compact Hue Progression (Level 4 Only)</h1>

                <div className="flex flex-wrap gap-1 max-w-6xl mx-auto p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.4)]">
                    {data.map(({ year }) => {
                        // Always use level 4 for the "highest level"
                        const style = getLevelStyle(year, 4)
                        return (
                            <div
                                key={year}
                                className={`h-6 w-6 rounded-md transition-opacity hover:opacity-80 ${DYNAMIC_CELL_CLASS}`}
                                style={style}
                                title={`${year} - Level 4`}
                            />
                        )
                    })}
                </div>
            </section>
        </main>
    )
}
