import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef } from 'react'
import { config } from '../../content/config'
import { useAudio } from '../../hooks/useAudio'

/** Cinematic fade from dark space, a cassette that plays the welcome voice note, then into the universe. */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const audio = useAudio('/audio/welcome.mp3')
  const playing = audio.status === 'playing' || audio.status === 'loading'

  useGSAP(
    () => {
      gsap
        .timeline()
        .from(root.current, { backgroundColor: '#000', duration: 1.8 })
        .from('.w-star', { opacity: 0, scale: 0, stagger: { each: 0.03, from: 'random' }, duration: 1 }, 0.2)
        .from('.w-in', { opacity: 0, y: 20, stagger: 0.25, duration: 1.1, ease: 'power2.out' }, 0.6)
    },
    { scope: root },
  )

  const enter = () => {
    audio.pause()
    gsap.to(root.current, { opacity: 0, scale: 1.04, duration: 0.8, ease: 'power2.in', onComplete: onEnter })
  }

  return (
    <div ref={root} className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
      {STARS.map((s, i) => (
        <span key={i} className="w-star absolute rounded-full bg-white" style={{ left: `${s[0]}%`, top: `${s[1]}%`, width: s[2], height: s[2], opacity: s[3] }} />
      ))}

      <p className="w-in text-[11px] tracking-[0.3em] text-white/45 uppercase">A little universe, for you</p>
      <h1 className="w-in font-display mt-2 text-4xl text-white">{config.welcomeTitle}</h1>

      <button onClick={audio.toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'} className="w-in mt-10 active:scale-[0.97] transition-transform">
        <Cassette spinning={audio.status === 'playing'} progress={audio.progress} />
      </button>
      <p className="w-in mt-4 h-5 text-sm text-white/60">
        {audio.status === 'missing'
          ? 'Voice note coming soon (add public/audio/welcome.mp3)'
          : audio.status === 'playing'
            ? 'Playing…'
            : audio.status === 'ended'
              ? 'Play it again anytime ♡'
              : config.welcomeLine}
      </p>

      <button onClick={enter} className="w-in mt-10 h-12 rounded-full bg-blush px-8 text-[15px] font-bold text-night-950 shadow-[0_0_30px_rgba(247,168,196,0.45)] active:scale-[0.97] transition-transform">
        Enter our universe
      </button>
    </div>
  )
}

const STARS: [number, number, number, number][] = Array.from({ length: 60 }, (_, i) => {
  const r = (n: number) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
  return [Math.abs(r(1)) * 100, Math.abs(r(2)) * 100, 1 + Math.abs(r(3)) * 2, 0.3 + Math.abs(r(4)) * 0.6]
})

function Cassette({ spinning, progress }: { spinning: boolean; progress: number }) {
  // tape moves from the left reel to the right reel as it plays
  const left = 16 - progress * 7
  const right = 9 + progress * 7
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" className="drop-shadow-[0_0_24px_rgba(247,168,196,0.35)]">
      <rect x="4" y="4" width="212" height="132" rx="14" fill="#f7a8c4" />
      <rect x="18" y="16" width="184" height="72" rx="8" fill="#fff4ea" />
      <text x="110" y="34" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="17" fill="#c2547f">
        for you ♡
      </text>
      <rect x="50" y="44" width="120" height="36" rx="18" fill="#2a1d33" />
      {[78, 142].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="62" r={i === 0 ? left : right} fill="#3c2b2b" opacity="0.9" />
          <g className={spinning ? 'reel-spin' : ''} style={{ transformOrigin: `${cx}px 62px` }}>
            <circle cx={cx} cy="62" r="9" fill="#fff4ea" />
            {[0, 60, 120].map((a) => (
              <rect key={a} x={cx - 1.5} y="54" width="3" height="16" fill="#c2547f" transform={`rotate(${a} ${cx} 62)`} />
            ))}
          </g>
        </g>
      ))}
      <path d="M40 136 L52 104 H168 L180 136" fill="#e889ad" />
      {[70, 96, 124, 150].map((x) => (
        <circle key={x} cx={x} cy="122" r="4" fill="#c2547f" />
      ))}
      {!spinning && <path d="M102 50 L122 62 L102 74 Z" fill="#fff4ea" opacity="0.95" />}
    </svg>
  )
}
