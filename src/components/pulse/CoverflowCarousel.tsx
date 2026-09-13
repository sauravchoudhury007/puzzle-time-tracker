'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

export type Photo = { src: string; label: string }

const ADVANCE_MS = 3800
/** One trackpad flick should move one card, not twenty. */
const WHEEL_COOLDOWN_MS = 280

/**
 * 3D rotating stack. Auto-advances, pauses on hover, ken-burns on the lead card.
 */
export default function CoverflowCarousel({
  photos,
  cardW = 440,
  cardH = 500,
  spread = 260,
  depth = 320,
}: {
  photos: Photo[]
  cardW?: number
  cardH?: number
  spread?: number
  depth?: number
}) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)

  const count = photos.length

  useEffect(() => {
    if (paused || count < 2) return
    const id = setInterval(() => setI(v => (v + 1) % count), ADVANCE_MS)
    return () => clearInterval(id)
  }, [paused, count])

  const step = useCallback(
    (direction: number) => setI(v => (v + direction + count) % count),
    [count]
  )

  // Trackpad / shift-wheel. Vertical intent is left alone so the page still scrolls.
  const lastWheel = useRef(0)
  const onWheel = (e: React.WheelEvent) => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
    if (!dx) return
    const now = Date.now()
    if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return
    lastWheel.current = now
    step(dx > 0 ? 1 : -1)
  }

  // Click-drag on desktop, swipe on touch.
  const dragFrom = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientX
    setDragging(true)
    setPaused(true)
  }
  // Roughly a third of a card of travel per step, so one deliberate drag moves one card.
  const dragStepPx = Math.max(70, cardW * 0.3)
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragFrom.current === null) return
    const dx = e.clientX - dragFrom.current
    if (Math.abs(dx) < dragStepPx) return
    step(dx < 0 ? 1 : -1)
    dragFrom.current = e.clientX
  }
  const endDrag = () => {
    dragFrom.current = null
    setDragging(false)
    setPaused(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      step(1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      step(-1)
      e.preventDefault()
    }
  }

  if (count === 0) return null

  // Shortest signed distance from the lead card, so the stack wraps around.
  const dist = (k: number) => {
    let d = (((k - i) % count) + count) % count
    if (d > count / 2) d -= count
    return d
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Highlight reel"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative',
        height: cardH + 52,
        perspective: '1600px',
        width: '100%',
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        // Let the page still scroll vertically over the reel on touch.
        touchAction: 'pan-y',
        outlineOffset: 4,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformStyle: 'preserve-3d',
        }}
      >
        {photos.map((p, k) => {
          const d = dist(k)
          const ad = Math.abs(d)
          const isLead = d === 0
          return (
            <div
              key={p.src}
              style={{
                position: 'absolute',
                width: `min(${cardW}px, 78vw)`,
                height: `min(${cardH}px, 62vh)`,
                transform: `translateX(${d * spread}px) translateZ(${-ad * depth}px) rotateY(${-d * 28}deg)`,
                transition: 'transform .9s cubic-bezier(.2,.7,.1,1), opacity .9s ease',
                opacity: ad > 3 ? 0 : 1 - ad * 0.18,
                zIndex: 100 - ad,
                transformStyle: 'preserve-3d',
                filter: isLead ? 'none' : `saturate(${Math.max(0, 0.6 - ad * 0.1)}) brightness(.85)`,
                willChange: 'transform',
                pointerEvents: isLead ? 'auto' : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: Math.round(cardW * 0.05),
                  overflow: 'hidden',
                  boxShadow: isLead
                    ? '0 30px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06)'
                    : '0 14px 28px rgba(0,0,0,.25)',
                  background: '#222',
                }}
              >
                <Image
                  src={p.src}
                  alt={p.label}
                  fill
                  // Cards are min(cardW, 78vw) wide, so the optimizer only ever sends that much photo.
                  sizes={`(max-width: ${Math.round(cardW / 0.78)}px) 78vw, ${cardW}px`}
                  priority={k < 2}
                  draggable={false}
                  style={{
                    objectFit: 'cover',
                    transform: isLead ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 4s ease-out',
                  }}
                />
                {isLead && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      bottom: 12,
                      maxWidth: '90%',
                      background: 'rgba(0,0,0,.55)',
                      color: '#fff',
                      fontSize: 12,
                      letterSpacing: '.06em',
                      padding: '6px 12px',
                      borderRadius: 99,
                      textTransform: 'uppercase',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {p.label}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 14,
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          zIndex: 200,
        }}
      >
        {photos.map((p, k) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Show photo ${k + 1}`}
            style={{
              width: k === i ? 22 : 6,
              height: 6,
              padding: 0,
              border: 0,
              background: k === i ? 'var(--accent)' : 'var(--ink)',
              opacity: k === i ? 1 : 0.25,
              borderRadius: 99,
              cursor: 'pointer',
              transition: 'width .3s ease, background .3s ease, opacity .3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
