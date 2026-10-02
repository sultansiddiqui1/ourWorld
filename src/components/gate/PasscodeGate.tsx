import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import { config } from '../../content/config'

const KEY = 'universe:unlocked'

export const isUnlocked = () => {
  try {
    return localStorage.getItem(KEY) === config.passcode
  } catch {
    return false
  }
}

/** A soft lock — keeps casual eyes out, not a real security boundary. */
export function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const len = config.passcode.length

  useGSAP(() => gsap.from('.gate-in', { opacity: 0, y: 16, stagger: 0.08, duration: 0.8, ease: 'power2.out' }), { scope: root })

  const press = (d: string) => {
    if (code.length >= len) return
    const next = code + d
    setCode(next)
    if (next.length < len) return
    if (next === config.passcode) {
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* private mode: unlock for this visit only */
      }
      navigator.vibrate?.(20)
      gsap.to(root.current, { opacity: 0, duration: 0.6, delay: 0.2, onComplete: onUnlock })
    } else {
      navigator.vibrate?.([30, 40, 30])
      gsap.fromTo('.gate-dots', { x: -12 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)', onComplete: () => setCode('') })
    }
  }

  return (
    <div ref={root} className="flex h-full flex-col items-center justify-center gap-8 px-8">
      <div className="gate-in text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="font-display mt-3 text-2xl text-white">Just for you</h1>
        <p className="mt-1 text-sm text-white/50">{config.passcodeHint}</p>
      </div>
      <div className="gate-in gate-dots flex gap-3">
        {Array.from({ length: len }, (_, i) => (
          <span key={i} className={`size-3.5 rounded-full border border-white/40 transition-colors ${i < code.length ? 'bg-blush border-blush' : ''}`} />
        ))}
      </div>
      <div className="gate-in grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              aria-label={k === '⌫' ? 'Delete' : k}
              onClick={() => (k === '⌫' ? setCode((c) => c.slice(0, -1)) : press(k))}
              className="size-[72px] rounded-full bg-white/[0.06] text-2xl font-light text-white active:bg-white/15"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
