'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getNavAccent, navLinks } from '@/lib/navLinks'

type NavPillProps = {
  currentHref: string
}

export default function NavPill({ currentHref }: NavPillProps) {
  const current = navLinks.find(link => link.href === currentHref) ?? navLinks[0]
  const accent = getNavAccent(current.href)
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative inline-flex z-[60]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_rgba(0,0,0,0.4)] backdrop-blur transition hover:border-white/25 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        {current.label}
      </button>

      <div
        data-testid="navpill-dropdown"
        className={`absolute left-0 top-full mt-2 min-w-[220px] translate-y-1 rounded-2xl border border-white/12 bg-[#0b1c3a]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.6)] transition duration-150 ease-out ${
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex flex-col gap-1">
          {navLinks.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
                item.href === current.href
                  ? 'bg-white/15 text-white'
                  : 'text-white/85 hover:bg-white/10'
              }`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
