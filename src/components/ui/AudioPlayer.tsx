import { useRef, type PointerEvent } from 'react'
import { useAudio } from '../../hooks/useAudio'

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/** Compact voice-note player: play/pause, tappable/scrubbable progress, time. */
export function AudioPlayer({ src, label = 'Hear me read this' }: { src: string; label?: string }) {
  const audio = useAudio(src)
  const bar = useRef<HTMLDivElement>(null)
  const missing = audio.status === 'missing'
  const playing = audio.status === 'playing' || audio.status === 'loading'

  const seekFrom = (e: PointerEvent) => {
    const r = bar.current?.getBoundingClientRect()
    if (r) audio.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#3a2a3a]/[0.07] p-2.5 pr-4">
      <button
        onClick={audio.toggle}
        disabled={missing}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[#c2547f] text-white shadow-md active:scale-95 disabled:bg-[#c2547f]/40"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11l9.5-5.5z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold text-[#5a3a4a]">{missing ? 'Voice note coming soon' : label}</p>
        <div
          ref={bar}
          className="relative mt-1.5 h-4 cursor-pointer touch-none"
          onPointerDown={(e) => {
            if (missing) return
            e.currentTarget.setPointerCapture(e.pointerId)
            seekFrom(e)
          }}
          onPointerMove={(e) => e.buttons && !missing && seekFrom(e)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#5a3a4a]/15" />
          <div className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-[#c2547f]" style={{ width: `${audio.progress * 100}%` }} />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c2547f] shadow"
            style={{ left: `${audio.progress * 100}%`, opacity: missing ? 0 : 1 }}
          />
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-[#5a3a4a]/60 tabular-nums">
        {fmt(audio.progress * audio.duration)} / {fmt(audio.duration)}
      </span>
    </div>
  )
}
