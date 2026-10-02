import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import type { Letter } from '../../content/letters'
import { AudioPlayer } from '../ui/AudioPlayer'
import { Envelope } from './Envelope'

gsap.registerPlugin(useGSAP)

/** Full-screen opening sequence: seal breaks → flap opens → letter rises → letter unfolds. */
export function LetterView({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.lv-stage', { display: 'none' })
        gsap.from('.lv-sheet', { opacity: 0, duration: 0.3 })
        return
      }
      gsap
        .timeline()
        .from('.lv-backdrop', { opacity: 0, duration: 0.35 })
        .from('.lv-stage', { scale: 0.55, y: 90, opacity: 0, duration: 0.65, ease: 'back.out(1.5)' }, '<0.05')
        .to('.lv-seal', { scale: 1.25, duration: 0.14, ease: 'power1.out' }, '+=0.15')
        .call(() => navigator.vibrate?.(15))
        .to('.lv-seal', { scale: 0, rotate: 50, opacity: 0, duration: 0.28, ease: 'back.in(2)' })
        .to('.lv-flap', { rotateX: 180, duration: 0.65, ease: 'power2.inOut' }, '-=0.05')
        .set('.lv-flap', { zIndex: 0 }, '-=0.32')
        .to('.lv-paper', { yPercent: -80, duration: 0.75, ease: 'power2.out' }, '-=0.1')
        .to('.lv-stage', { y: 320, opacity: 0, duration: 0.5, ease: 'power2.in' }, '+=0.15')
        .fromTo('.lv-sheet', { opacity: 0, scale: 0.6, y: 60, rotate: -2 }, { opacity: 1, scale: 1, y: 0, rotate: 0, duration: 0.7, ease: 'power3.out' }, '<0.1')
        .from('.lv-line', { opacity: 0, y: 10, stagger: 0.14, duration: 0.5, ease: 'power1.out' }, '-=0.25')
    },
    { scope: root },
  )

  const close = () => gsap.to(root.current, { opacity: 0, duration: 0.3, onComplete: onClose })

  return (
    <div ref={root} className="absolute inset-0 z-30 overflow-hidden" role="dialog" aria-modal="true" aria-label={`Open when ${letter.when}`}>
      <div className="lv-backdrop absolute inset-0 bg-night-950/85 backdrop-blur-sm" onClick={close} />

      {/* the envelope that opens */}
      <div className="lv-stage pointer-events-none absolute top-1/2 left-1/2 w-[78%] max-w-[320px] -translate-x-1/2 -translate-y-1/2">
        <Envelope color={letter.color} emoji={letter.emoji} hook="lv" />
      </div>

      {/* the unfolded letter */}
      <article className="lv-sheet absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] bottom-4 flex flex-col overflow-hidden rounded-[22px] bg-[#fff8ef] text-[#3d2b35] opacity-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="h-1.5 w-full shrink-0" style={{ background: letter.color }} />
        <button
          onClick={close}
          aria-label="Close letter"
          className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full text-[#3d2b35]/50 active:bg-black/5"
        >
          ✕
        </button>
        <div className="flex-1 overflow-y-auto px-6 pt-7 pb-6">
          <p className="lv-line text-[11px] font-bold tracking-[0.22em] text-[#c2547f] uppercase">Open when…</p>
          <h2 className="lv-line font-display mt-1 pr-8 text-[26px] leading-tight">
            {letter.when} <span className="text-[22px]">{letter.emoji}</span>
          </h2>
          <div className="lv-line mt-4">
            <AudioPlayer src={letter.audio} />
          </div>
          {/* ruled paper: one 38px rule per text line, paragraphs separated by one empty line */}
          <div
            className="font-hand mt-5 space-y-[38px] text-[25px] leading-[38px]"
            style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 36px, rgba(194,84,127,0.16) 36px 37px, transparent 37px 38px)' }}
          >
            {letter.body.map((p, i) => (
              <p key={i} className="lv-line">
                {p}
              </p>
            ))}
            <p className="lv-line text-right">
              {letter.signoff} <span className="text-[#c2547f]">♡</span>
            </p>
          </div>
        </div>
        <button onClick={close} className="h-14 shrink-0 border-t border-[#3d2b35]/10 text-sm font-bold text-[#c2547f] active:bg-black/5">
          Fold it back up
        </button>
      </article>
    </div>
  )
}
