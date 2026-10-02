import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatShort } from '../../lib/dates'
import type { GardenDay } from '../../lib/flowers'
import Garden, { CAMERA, SPACING, type ScrollState } from './Garden'

interface Props {
  days: GardenDay[]
  active: boolean
  onOpen: (index: number) => void
}

/** Swipeable strip of days. Owns the scroll position the 3D scene reads every frame. */
export default function GardenView({ days, active, onOpen }: Props) {
  const last = days.length - 1
  const scroll = useRef<ScrollState>({ v: last }).current
  const [focus, setFocus] = useState(last)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; v0: number; lastX: number; lastT: number; vel: number } | null>(null)

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(last, Math.round(i)))
      gsap.to(scroll, { v: target, duration: 0.7, ease: 'power3.out', overwrite: true })
    },
    [last, scroll],
  )

  // A new day bloomed while the app was open → glide to it.
  useEffect(() => {
    goTo(last)
  }, [last, goTo])

  /** Screen pixels per flower, from the camera's visible width at the flower row. */
  const pxPerFlower = () => {
    const el = wrap.current
    if (!el) return 120
    const dist = Math.hypot(CAMERA.position[1] - CAMERA.lookAt[1], CAMERA.position[2])
    const visibleW = 2 * Math.tan(((CAMERA.fov / 2) * Math.PI) / 180) * dist * (el.clientWidth / el.clientHeight)
    return (el.clientWidth / visibleW) * SPACING
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    gsap.killTweensOf(scroll)
    drag.current = { x: e.clientX, v0: scroll.v, lastX: e.clientX, lastT: performance.now(), vel: 0 }
    const ppf = pxPerFlower()
    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const now = performance.now()
      const dt = Math.max(1, now - d.lastT)
      d.vel = 0.8 * d.vel + 0.2 * ((ev.clientX - d.lastX) / dt)
      d.lastX = ev.clientX
      d.lastT = now
      let v = d.v0 - (ev.clientX - d.x) / ppf
      // rubber-band past the ends
      if (v < 0) v = v * 0.35
      if (v > last) v = last + (v - last) * 0.35
      scroll.v = v
    }
    const up = () => {
      const d = drag.current
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!d) return
      const fling = (-d.vel * 220) / ppf // px/ms → flowers
      goTo(scroll.v + fling)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const handleTap = useCallback(
    (i: number) => {
      goTo(i)
      onOpen(i)
    },
    [goTo, onOpen],
  )

  const day = days[focus]
  const isToday = focus === last

  return (
    <div ref={wrap} className="relative h-full w-full touch-pan-y select-none" onPointerDown={onPointerDown}>
      <Garden days={days} scroll={scroll} focus={focus} active={active} bloomToday onFocus={setFocus} onTap={handleTap} />

      <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-[11px] tracking-[0.18em] text-white/45 uppercase">
        Our never-wilt garden
      </div>

      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-4">
        <button
          aria-label="Previous day"
          className="grid size-11 place-items-center rounded-full text-white/70 active:scale-95 disabled:opacity-25"
          disabled={focus === 0}
          onClick={() => goTo(focus - 1)}
        >
          <Chevron dir="left" />
        </button>
        <button
          onClick={() => onOpen(focus)}
          className="glass min-w-0 flex-1 max-w-[260px] rounded-full px-4 py-2 text-center active:scale-[0.98] transition-transform"
        >
          <span className="block truncate text-[13px] font-semibold text-white/90">
            Day {focus + 1} · {formatShort(day.key)}
          </span>
          <span className="block truncate text-[11px] text-blush">
            {day.special ?? (isToday ? 'Today’s bloom — tap to read' : 'Tap to read its note')}
          </span>
        </button>
        <button
          aria-label="Next day"
          className="grid size-11 place-items-center rounded-full text-white/70 active:scale-95 disabled:opacity-25"
          disabled={isToday}
          onClick={() => goTo(focus + 1)}
        >
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}
