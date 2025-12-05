'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'

type CarouselImage = {
  src: string
  alt: string
}

type Carousel3DProps = {
  images: CarouselImage[]
}

const AUTO_ROTATE_MS = 3000
const DEFAULT_DEPTH = 360

export default function Carousel3D({ images }: Carousel3DProps) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const step = useMemo(() => 360 / images.length, [images.length])
  const containerTransform = useMemo(
    () => `translateZ(-${depth}px) rotateY(${index * step}deg)`,
    [depth, index, step]
  )

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(
      () => setIndex((prev) => (prev + 1) % images.length),
      AUTO_ROTATE_MS
    )
    return () => clearInterval(timer)
  }, [images.length, isPaused])

  const rotateTo = (direction: number) => {
    setIndex((prev) => (prev + direction + images.length) % images.length)
  }

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const updateDepth = () => {
      const width = el.getBoundingClientRect().width
      // Scale the radius with the available width so side panels stay visible on large screens.
      const nextDepth = Math.max(280, Math.min(width * 0.32, 520))
      setDepth(nextDepth)
    }

    updateDepth()
    const observer = new ResizeObserver(updateDepth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative w-full">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/10 via-transparent to-white/5 blur-3xl" />
      <div
        ref={wrapperRef}
        className="relative h-[420px] w-full overflow-visible"
        style={{ perspective: `${depth * 4}px`, perspectiveOrigin: '50% 50%' }}
      >
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative mx-auto flex h-full max-w-4xl items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: containerTransform,
            transition: 'transform 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {images.map((image, i) => (
            <figure
              key={image.src}
              className="absolute flex h-72 w-64 flex-col justify-between rounded-3xl border border-white/15 bg-white/10 p-4 text-sm text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateY(${i * step}deg) translateZ(${depth}px)`,
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            >
              <div className="relative h-48 w-full overflow-hidden rounded-2xl">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="250px"
                  className="object-cover"
                  unoptimized
                  priority={i < 2}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              </div>
              <figcaption className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/70">
                <span>Captured</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold text-white">
                  {i + 1}/{images.length}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => rotateTo(-1)}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20"
            aria-label="Previous image"
          >
            ←
          </button>
          <button
            onClick={() => rotateTo(1)}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20"
            aria-label="Next image"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i === index ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
