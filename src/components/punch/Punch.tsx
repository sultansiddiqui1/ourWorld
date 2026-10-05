import gsap from 'gsap'
import { useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../../lib/sfx'
import PunchScene, { type Hit, type PunchApi, type Zone } from './PunchScene'

/** Damage per zone (min, max) in percent. Crits double it. */
const DAMAGE: Record<Exclude<Zone, 'arm'>, [number, number]> = { face: [8, 12], head: [5, 8], body: [3, 5], legs: [2, 3] }
const CRIT_CHANCE = 0.12
const STATS_KEY = 'punch:v1'

/**
 * TODO: rewrite these in your own words. They're shown in order — each "apologise more"
 * goes one step further — and then keep cycling with a growing sorry counter.
 */
const APOLOGIES = [
  'Okay okay, I deserved that 🥺 Sorry I didn’t reply ❤️',
  'I’m really, really sorry. I should’ve texted you back. 🥺',
  'Sorry sorry sorry! Replies in under 5 minutes from now on ⏱️',
  'Good morning AND good night texts. Every single day. Promise 🌅🌙',
  'I’m literally on the floor. Please forgive me 🙏',
  'I’ll buy you momos next time. As many as you want 🥟',
  'You’re right, I’m wrong, you’re beautiful, I’m sorry ❤️',
  'Writing it 100 times: sorry sorry sorry sorry sorry sorry… 📝',
]
const apologyFor = (n: number) => (n < APOLOGIES.length ? APOLOGIES[n] : `Sorry × ${n + 1}… ${APOLOGIES[n % APOLOGIES.length]}`)
const OUCHES = ['OW!', 'OOF!', 'HEY!', 'AIII!', 'OUCH!', 'BONK!']
const FLEXES = ['💪 you like these?', '💪 all yours', '💪 pew pew', '💪 feel that?']

interface Stats {
  punches: number
  kos: number
}
function loadStats(): Stats {
  try {
    return { punches: 0, kos: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') }
  } catch {
    return { punches: 0, kos: 0 }
  }
}

interface Pop {
  id: number
  x: number
  y: number
  text: string
  crit: boolean
}

type Phase = 'fighting' | 'ko' | 'gettingUp'

export default function Punch({ active }: { active: boolean }) {
  const api = useRef<PunchApi>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [damage, setDamage] = useState(0)
  const [phase, setPhase] = useState<Phase>('fighting')
  const [stats, setStats] = useState(loadStats)
  const [pops, setPops] = useState<Pop[]>([])
  const [sorryCard, setSorryCard] = useState(false)
  const [koText, setKoText] = useState(false)
  const [sorryN, setSorryN] = useState(0)
  const [hearts, setHearts] = useState<{ id: number; dx: number; dy: number; delay: number; e: string }[]>([])
  const falling = useRef<Promise<void> | null>(null)
  const dmgRef = useRef(0)
  const popId = useRef(0)

  // functional update: rapid taps land between renders, so never build on a stale snapshot
  const bump = (key: keyof Stats) =>
    setStats((prev) => {
      const next = { ...prev, [key]: prev[key] + 1 }
      try {
        localStorage.setItem(STATS_KEY, JSON.stringify(next))
      } catch {
        /* private mode: stats last for this visit */
      }
      return next
    })

  const flexing = useRef(false)
  const showPop = (hit: Hit, text: string, crit = false) => {
    const r = wrap.current!.getBoundingClientRect()
    const id = ++popId.current
    setPops((p) => [...p, { id, x: hit.clientX - r.left, y: hit.clientY - r.top, text, crit }])
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900)
  }

  const onHit = (hit: Hit) => {
    if (phase !== 'fighting' || !api.current) return
    // touching the arms doesn't hurt — he shows off instead 💪
    if (hit.zone === 'arm') {
      if (flexing.current) return
      flexing.current = true
      showPop(hit, FLEXES[Math.floor(Math.random() * FLEXES.length)])
      void api.current.flex().then(() => (flexing.current = false))
      return
    }
    const [lo, hi] = DAMAGE[hit.zone]
    const crit = Math.random() < CRIT_CHANCE
    const amount = Math.round((lo + Math.random() * (hi - lo)) * (crit ? 2 : 1))
    const next = Math.min(100, dmgRef.current + amount)
    dmgRef.current = next
    setDamage(next)
    bump('punches')

    // floating "OW! +9%" where she tapped
    const word = crit ? 'CRIT!' : OUCHES[Math.floor(Math.random() * OUCHES.length)]
    showPop(hit, `${word} +${amount}%`, crit)

    // screen shake + thump
    gsap.fromTo(wrap.current, { x: crit ? -10 : -5 }, { x: 0, duration: 0.35, ease: 'elastic.out(1.2, 0.3)' })
    navigator.vibrate?.(crit ? [20, 30, 40] : 18)
    sfx.punch(amount / 24, crit)

    if (next >= 100) knockOut(hit)
    else api.current.react(hit, Math.min(1, amount / 20))
  }

  const knockOut = async (hit: Hit) => {
    setPhase('ko')
    setSorryN(0)
    setKoText(true)
    window.setTimeout(() => setKoText(false), 2200)
    sfx.ko()
    // the apology pops up while he's still falling; he stays down until she forgives him
    window.setTimeout(() => setSorryCard(true), 500)
    falling.current = api.current!.knockOut(hit)
    await falling.current
    navigator.vibrate?.([40, 60, 80])
    bump('kos')
  }

  const apologiseMore = () => {
    setSorryN((n) => n + 1)
    api.current?.plead()
    navigator.vibrate?.([15, 40, 15])
  }

  const blowKiss = () => {
    const now = Date.now()
    setHearts(
      Array.from({ length: 9 }, (_, i) => ({
        id: now + i,
        dx: (Math.random() - 0.5) * 260,
        dy: -60 - Math.random() * 220,
        delay: i * 0.07,
        e: i % 3 === 0 ? '💋' : '❤️',
      })),
    )
    navigator.vibrate?.(30)
    window.setTimeout(() => setHearts([]), 2200)
  }

  const forgive = async () => {
    if (phase !== 'ko') return
    setSorryCard(false)
    setPhase('gettingUp')
    await falling.current // in case she forgives him mid-fall
    await api.current!.getUp()
    sfx.getUp()
    gsap.to(dmgRef, { current: 0, duration: 1.2, ease: 'power2.inOut', onUpdate: () => setDamage(Math.round(dmgRef.current)) })
    await api.current!.kiss(blowKiss)
    setPhase('fighting')
  }

  const hue = 120 - damage * 1.2 // green → yellow → red

  return (
    <div ref={wrap} className="relative h-full touch-none select-none">
      <PunchScene apiRef={api} active={active} damage={damage} onHit={onHit} />

      {/* header + damage meter */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.25em] text-white/50 uppercase">Didn’t reply?</p>
            <h1 className="font-display text-[24px] leading-tight text-white">Punch me</h1>
          </div>
          <p className="mt-1 text-right text-[11px] leading-4 text-white/55">
            🥊 {stats.punches} punches
            <br />
            💫 {stats.kos} knockouts
          </p>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[12px] font-bold">
            <span className="tracking-[0.18em] text-white/60 uppercase">Damage</span>
            <span className="tabular-nums text-[18px]" style={{ color: `hsl(${hue} 85% 62%)` }}>
              {damage}%
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{ width: `${damage}%`, background: `linear-gradient(90deg, hsl(120 70% 50%), hsl(${hue} 85% 55%))` }}
            />
          </div>
        </div>
      </div>

      {/* floating hit text */}
      {pops.map((p) => (
        <span
          key={p.id}
          className={`hit-pop pointer-events-none absolute z-10 -translate-x-1/2 font-black whitespace-nowrap ${p.crit ? 'text-[26px] text-[#ffd84d]' : 'text-[20px] text-white'}`}
          style={{ left: p.x, top: p.y - 30, textShadow: '0 2px 0 #c2547f, 0 0 12px rgba(0,0,0,0.6)' }}
        >
          {p.text}
        </span>
      ))}

      {koText && (
        <div className="ko-pop pointer-events-none absolute inset-x-0 top-[17%] text-center">
          <span className="font-display text-[64px] font-semibold text-[#ffd84d]" style={{ textShadow: '0 4px 0 #c2547f, 0 0 30px rgba(255,216,77,0.5)' }}>
            K.O.!
          </span>
        </div>
      )}

      {sorryCard && (
        <div className="absolute inset-x-5 bottom-5 z-20">
          <div key={sorryN} className="card-pop rounded-[24px] bg-[#fff8ef] p-5 text-center text-[#3d2b35] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            {sorryN > 0 && <p className="text-[11px] font-bold tracking-[0.2em] text-[#c2547f] uppercase">Sorry #{sorryN + 1}</p>}
            <p className="font-hand mt-1 text-[27px] leading-tight">{apologyFor(sorryN)}</p>
            <button onClick={forgive} className="mt-4 h-12 w-full rounded-2xl bg-[#c2547f] text-sm font-bold text-white active:scale-[0.98]">
              Fine, you’re forgiven ❤️
            </button>
            <button onClick={apologiseMore} className="mt-2 h-11 w-full rounded-2xl bg-[#3d2b35]/[0.07] text-sm font-bold text-[#3d2b35]/80 active:scale-[0.98]">
              Not enough. Apologise more 😤
            </button>
          </div>
        </div>
      )}

      {/* flying kiss: hearts burst out of the screen toward her */}
      {hearts.map((h) => (
        <span
          key={h.id}
          className="kiss-fly pointer-events-none absolute top-[40%] left-1/2 z-30 text-[34px]"
          style={{ '--dx': `${h.dx}px`, '--dy': `${h.dy}px`, animationDelay: `${h.delay}s` } as CSSProperties}
        >
          {h.e}
        </span>
      ))}

      {phase === 'fighting' && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-[12px] tracking-wider text-white/45">
          tap to punch · face hits hurt most · tap my arms 💪
        </p>
      )}
    </div>
  )
}
