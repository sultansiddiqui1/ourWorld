import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sfx } from '../../lib/sfx'
import LoveScene, { type LoveApi, type Outfit, type SceneId, type Touch } from './LoveScene'

/** TODO: write your own — one is shown each time the love meter fills up. */
const LOVE_MESSAGES = [
  'You fill me up to 100% every single day ❤️',
  'However far apart we are, I’m always yours 🌙',
  'You + me = my favourite place in the universe 🌌',
  'I love you more than all the stars over Nepal ✨',
]
/** Your recorded "I love you" (plays at 100% once the file exists). */
const VOICE_I_LOVE_YOU = '/audio/love/i-love-you.mp3'

type Move =
  | 'pat' | 'cheekKiss' | 'herKiss' | 'hug' | 'spin' | 'giggle' | 'flex' | 'holdHands'
  | 'flower' | 'heart' | 'slowDance' | 'nap' | 'feed' | 'tickle' | 'selfie'
type Sound = 'kiss' | 'giggle' | 'heartbeat' | 'chime' | 'shutter' | 'pop'

/** The buttons, worded from her side. `unlock` = how many times the meter must have been filled. */
const MOVES: { move: Move; emoji: string; label: string; gain: number; unlock?: number; count?: 'kisses' | 'hugs'; sound: Sound }[] = [
  { move: 'herKiss', emoji: '💋', label: 'Kiss him', gain: 8, count: 'kisses', sound: 'kiss' },
  { move: 'hug', emoji: '🤗', label: 'Hug', gain: 12, count: 'hugs', sound: 'heartbeat' },
  { move: 'cheekKiss', emoji: '😘', label: 'Get a kiss', gain: 7, sound: 'kiss' },
  { move: 'flower', emoji: '🌹', label: 'Give me a flower', gain: 9, sound: 'chime' },
  { move: 'selfie', emoji: '🤳', label: 'Selfie', gain: 6, sound: 'shutter' },
  { move: 'feed', emoji: '🥟', label: 'Momo time', gain: 7, sound: 'giggle' },
  { move: 'pat', emoji: '🥰', label: 'Pat his head', gain: 4, sound: 'pop' },
  { move: 'holdHands', emoji: '🤝', label: 'Hold hands', gain: 6, sound: 'heartbeat' },
  { move: 'spin', emoji: '💫', label: 'Twirl me', gain: 8, sound: 'chime' },
  { move: 'giggle', emoji: '💕', label: 'Make me giggle', gain: 3, sound: 'giggle' },
  { move: 'flex', emoji: '💪', label: 'Flex for me', gain: 5, sound: 'pop' },
  { move: 'heart', emoji: '🫶', label: 'Make a heart', gain: 10, unlock: 1, sound: 'chime' },
  { move: 'tickle', emoji: '🙈', label: 'Tickle fight', gain: 8, unlock: 1, sound: 'giggle' },
  { move: 'slowDance', emoji: '💃', label: 'Slow dance', gain: 12, unlock: 2, sound: 'chime' },
  { move: 'nap', emoji: '😴', label: 'Nap together', gain: 9, unlock: 3, sound: 'heartbeat' },
]
const MILESTONES: { at: number; move: 'holdHands' | 'foreheadKiss' | 'dance'; label: string }[] = [
  { at: 25, move: 'holdHands', label: 'Holding hands 🤝' },
  { at: 50, move: 'foreheadKiss', label: 'Forehead kiss 😚' },
  { at: 75, move: 'dance', label: 'Our little dance 💃🕺' },
]
const OUTFIT_LIST: { id: Outfit | 'auto'; label: string }[] = [
  { id: 'auto', label: '🌗 Auto (pyjamas at night)' },
  { id: 'everyday', label: '👕 Everyday' },
  { id: 'festive', label: '🪔 Festive' },
  { id: 'couple', label: '💞 Couple tees' },
  { id: 'pyjamas', label: '🌙 Pyjamas' },
]
const SCENE_LIST: { id: SceneId; label: string }[] = [
  { id: 'night', label: '🌌 Starry night' },
  { id: 'sunset', label: '🌇 Sunset rooftop' },
  { id: 'beach', label: '🏖️ Beach' },
  { id: 'himalaya', label: '🏔️ Himalaya' },
]

const KEY = 'love:v1'
const PREFS = 'love:prefs'
interface Sent {
  kisses: number
  hugs: number
  full: number
}
interface Prefs {
  outfit: Outfit | 'auto'
  scene: SceneId
  sound: boolean
  music: boolean
}
function load<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
  } catch {
    return fallback
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}
const isNight = () => {
  const h = new Date().getHours()
  return h >= 22 || h < 6
}

interface Pop {
  id: number
  x: number
  y: number
  text: string
}
interface Burst {
  id: number
  dx: number
  dy: number
  delay: number
  e: string
}

export default function Love({ active }: { active: boolean }) {
  const api = useRef<LoveApi>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [love, setLove] = useState(0)
  const [sent, setSent] = useState(() => load<Sent>(KEY, { kisses: 0, hugs: 0, full: 0 }))
  const [prefs, setPrefs] = useState(() => load<Prefs>(PREFS, { outfit: 'auto', scene: 'night', sound: true, music: false }))
  const [pops, setPops] = useState<Pop[]>([])
  const [burst, setBurst] = useState<Burst[]>([])
  const [banner, setBanner] = useState('')
  const [message, setMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [photo, setPhoto] = useState('')
  const [flash, setFlash] = useState(false)
  const [zzz, setZzz] = useState(false)
  const [menu, setMenu] = useState<'' | 'outfit' | 'scene'>('')
  const grid = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: true })
  const updateScroll = () => {
    const g = grid.current
    if (!g) return
    setCanScroll({ left: g.scrollLeft > 4, right: g.scrollLeft + g.clientWidth < g.scrollWidth - 4 })
  }
  const page = (dir: 1 | -1) => {
    const g = grid.current
    if (!g) return
    g.scrollBy({ left: dir * g.clientWidth * 0.92, behavior: 'smooth' })
    sfx.pop()
  }
  const busy = useRef(false)
  const idling = useRef(false)
  const loveRef = useRef(0)
  const id = useRef(0)
  const lastAction = useRef(Date.now())

  const outfit: Outfit = prefs.outfit === 'auto' ? (isNight() ? 'pyjamas' : 'everyday') : prefs.outfit
  const setPref = (p: Partial<Prefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...p }
      store(PREFS, next)
      return next
    })
  const bumpSent = (fn: (s: Sent) => Sent) =>
    setSent((prev) => {
      const next = fn(prev)
      store(KEY, next)
      return next
    })

  // sound + music follow her settings (and stop when the tab is left)
  useEffect(() => sfx.setMuted(!prefs.sound), [prefs.sound])
  useEffect(() => {
    sfx.music(active && prefs.music && prefs.sound)
    return () => sfx.music(false)
  }, [active, prefs.music, prefs.sound])

  // idle life: every so often, when nothing is happening, they do something small on their own
  useEffect(() => {
    if (!active) return
    const iv = window.setInterval(() => {
      if (busy.current || idling.current || message || photo || Date.now() - lastAction.current < 6000) return
      idling.current = true
      lastAction.current = Date.now()
      void api.current?.idle().finally(() => (idling.current = false))
    }, 4000)
    return () => window.clearInterval(iv)
  }, [active, message, photo])

  const pop = (x: number, y: number, text: string) => {
    const r = wrap.current!.getBoundingClientRect()
    const i = ++id.current
    setPops((p) => [...p, { id: i, x: x - r.left, y: y - r.top, text }])
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== i)), 1100)
  }

  const heartBurst = (n = 14) => {
    const now = Date.now()
    setBurst(
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return { id: now + i, dx: Math.cos(a) * (120 + Math.random() * 80), dy: Math.sin(a) * (120 + Math.random() * 80) - 60, delay: Math.random() * 0.2, e: i % 4 ? '❤️' : '💖' }
      }),
    )
    window.setTimeout(() => setBurst([]), 2000)
  }

  const runMove = (move: Move): Promise<void> => {
    const a = api.current!
    if (move === 'selfie')
      return a.selfie((url) => {
        setFlash(true)
        window.setTimeout(() => setFlash(false), 180)
        window.setTimeout(() => setPhoto(url), 450)
      })
    if (move === 'nap') {
      setZzz(true)
      return a.nap().finally(() => setZzz(false))
    }
    return a[move]()
  }

  /** Play a move, add its love, then any milestone moment it unlocked. */
  const play = async (move: Move, at?: { x: number; y: number }) => {
    if (!api.current || message || busy.current) return
    if (idling.current) api.current.stopIdle() // idle moments are just ambience — cut them short
    const def = MOVES.find((m) => m.move === move)!
    busy.current = true
    setIsBusy(true)
    lastAction.current = Date.now()
    if (at) pop(at.x, at.y, `${def.emoji} +${def.gain}%`)
    navigator.vibrate?.(12)
    sfx[def.sound]()
    await runMove(move)
    const before = loveRef.current
    const after = Math.min(100, before + def.gain)
    loveRef.current = after
    setLove(after)
    for (const m of MILESTONES) {
      if (before < m.at && after >= m.at) {
        setBanner(m.label)
        sfx.chime()
        await api.current[m.move]()
        setBanner('')
      }
    }
    if (after >= 100) {
      heartBurst(22)
      navigator.vibrate?.([30, 50, 30, 50, 60])
      sfx.heartbeat()
      if (prefs.sound) void new Audio(VOICE_I_LOVE_YOU).play().catch(() => {}) // your voice, once recorded
      const newlyUnlocked = MOVES.filter((m) => m.unlock === sent.full + 1)
      bumpSent((s) => ({ ...s, full: s.full + 1 }))
      await api.current.celebrate()
      setMessage(LOVE_MESSAGES[Math.floor(Math.random() * LOVE_MESSAGES.length)])
      if (newlyUnlocked.length) setBanner(`New move unlocked: ${newlyUnlocked.map((m) => `${m.emoji} ${m.label}`).join(' · ')}`)
    }
    busy.current = false
    setIsBusy(false)
    lastAction.current = Date.now()
  }

  const onTouch = (t: Touch, kind: 'tap' | 'long' | 'swipe') => {
    const at = { x: t.clientX, y: t.clientY }
    if (kind === 'long') return play('hug', at)
    if (kind === 'swipe') return play('spin', at)
    if (t.who === 'her') return play('giggle', at)
    if (t.zone === 'arm') return play('flex', at)
    if (t.zone === 'face') return play('cheekKiss', at)
    return play('pat', at)
  }

  const press = (m: (typeof MOVES)[number]) => {
    if (message || busy.current || (m.unlock && sent.full < m.unlock)) return
    if (m.count) bumpSent((s) => ({ ...s, [m.count!]: s[m.count!] + 1 }))
    const r = wrap.current!.getBoundingClientRect()
    void play(m.move, { x: r.left + r.width / 2, y: r.top + r.height * 0.36 })
  }

  const again = () => {
    setMessage('')
    setBanner('')
    loveRef.current = 0
    setLove(0)
  }

  const savePhoto = async () => {
    const name = `us-${new Date().toISOString().slice(0, 10)}.jpg`
    try {
      const blob = await (await fetch(photo)).blob()
      const file = new File([blob], name, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Us ❤️' })
        return
      }
    } catch {
      /* fall back to a download */
    }
    const a = document.createElement('a')
    a.href = photo
    a.download = name
    a.click()
  }

  return (
    <div ref={wrap} className="relative h-full touch-none select-none">
      <LoveScene apiRef={api} active={active} love={love} outfit={outfit} scene={prefs.scene} onTouch={onTouch} />

      {/* header: meter + settings */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.25em] text-white/50 uppercase">When you love me</p>
            <h1 className="font-display text-[24px] leading-tight text-white">Love me</h1>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            {[
              { k: 'outfit', icon: '👗', on: () => setMenu(menu === 'outfit' ? '' : 'outfit') },
              { k: 'scene', icon: '🏞️', on: () => setMenu(menu === 'scene' ? '' : 'scene') },
              { k: 'music', icon: prefs.music ? '🎶' : '🎵', on: () => setPref({ music: !prefs.music, sound: true }) },
              { k: 'sound', icon: prefs.sound ? '🔊' : '🔇', on: () => setPref({ sound: !prefs.sound }) },
            ].map((b) => (
              <button
                key={b.k}
                onClick={b.on}
                aria-label={b.k}
                className={`glass grid size-9 place-items-center rounded-full text-[16px] active:scale-90 ${b.k === 'music' && prefs.music ? 'ring-1 ring-blush' : ''}`}
              >
                {b.icon}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[12px] font-bold">
            <span className="tracking-[0.18em] text-white/60 uppercase">Love</span>
            <span className="text-[11px] font-semibold text-white/50">
              💋 {sent.kisses} · 🤗 {sent.hugs} · 💖 {sent.full}×
            </span>
            <span className="text-[18px] text-[#ff8fbf] tabular-nums">{love}%</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ff9cc4] to-[#ff3d7f] transition-[width] duration-300" style={{ width: `${love}%` }} />
          </div>
          <div className="relative mt-0.5 h-3 text-[9px] text-white/35">
            {MILESTONES.map((m) => (
              <span key={m.at} className="absolute -translate-x-1/2" style={{ left: `${m.at}%` }}>
                {love >= m.at ? '♥' : '·'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {menu && (
        <div className="card-pop absolute top-[max(64px,calc(env(safe-area-inset-top)+50px))] right-4 z-30 w-56 rounded-2xl bg-[#fff8ef] p-2 text-[#3d2b35] shadow-xl">
          {(menu === 'outfit' ? OUTFIT_LIST : SCENE_LIST).map((o) => {
            const on = menu === 'outfit' ? prefs.outfit === o.id : prefs.scene === o.id
            return (
              <button
                key={o.id}
                onClick={() => {
                  setPref(menu === 'outfit' ? { outfit: o.id as Prefs['outfit'] } : { scene: o.id as SceneId })
                  setMenu('')
                  sfx.pop()
                }}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold ${on ? 'bg-[#c2547f]/15 text-[#c2547f]' : 'active:bg-black/5'}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {banner && (
        <div className="card-pop pointer-events-none absolute inset-x-6 top-[22%] text-center">
          <span className="inline-block rounded-full bg-[#fff8ef] px-4 py-2 text-[14px] font-bold text-[#c2547f] shadow-lg">{banner}</span>
        </div>
      )}

      {zzz && (
        <div className="pointer-events-none absolute top-[30%] left-1/2 z-10 font-display text-[28px] text-white/80">
          {['Z', 'z', 'z'].map((c, i) => (
            <span key={i} className="zzz absolute" style={{ animationDelay: `${i * 0.55}s`, left: i * 14 }}>
              {c}
            </span>
          ))}
        </div>
      )}

      {pops.map((p) => (
        <span
          key={p.id}
          className="hit-pop pointer-events-none absolute z-10 -translate-x-1/2 text-[20px] font-black whitespace-nowrap text-white"
          style={{ left: p.x, top: p.y - 30, textShadow: '0 2px 0 #c2547f, 0 0 12px rgba(0,0,0,0.5)' }}
        >
          {p.text}
        </span>
      ))}

      {burst.map((h) => (
        <span
          key={h.id}
          className="kiss-fly pointer-events-none absolute top-[42%] left-1/2 z-30 text-[30px]"
          style={{ '--dx': `${h.dx}px`, '--dy': `${h.dy}px`, animationDelay: `${h.delay}s` } as CSSProperties}
        >
          {h.e}
        </span>
      ))}

      {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white" />}

      {photo && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 px-8 backdrop-blur-sm" onClick={() => setPhoto('')}>
          <div className="card-pop w-full max-w-[300px] -rotate-2 bg-white p-3 pb-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={photo} alt="Our selfie" className="aspect-[3/4] w-full object-cover object-[50%_45%]" />
            <p className="font-hand mt-2 text-center text-[24px] text-[#3d2b35]">us ❤️ {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={savePhoto} className="h-11 flex-1 rounded-xl bg-[#c2547f] text-sm font-bold text-white">
                Save 📥
              </button>
              <button onClick={() => setPhoto('')} className="h-11 flex-1 rounded-xl bg-black/5 text-sm font-bold text-[#3d2b35]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {message ? (
        <div className="absolute inset-x-5 bottom-5 z-20">
          <div className="card-pop rounded-[24px] bg-[#fff8ef] p-5 text-center text-[#3d2b35] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#c2547f] uppercase">Love meter full 💖</p>
            <p className="font-hand mt-1 text-[28px] leading-tight">{message}</p>
            <button onClick={again} className="mt-4 h-12 w-full rounded-2xl bg-[#c2547f] text-sm font-bold text-white active:scale-[0.98]">
              Fill it up again ❤️
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-3 flex items-center gap-1 px-1">
          <ScrollArrow dir="left" disabled={!canScroll.left} onClick={() => page(-1)} />
          {/* two rows of buttons; arrows (or a swipe) page through the rest */}
          <div
            ref={grid}
            onScroll={updateScroll}
            className="grid min-w-0 flex-1 touch-pan-x snap-x snap-mandatory auto-cols-[calc((100%-1.5rem)/4)] grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
          >
            {MOVES.map((m) => {
              const locked = !!m.unlock && sent.full < m.unlock
              return (
                <button
                  key={m.move}
                  onClick={() => press(m)}
                  disabled={isBusy || locked}
                  className="glass flex h-[62px] snap-start flex-col items-center justify-center gap-0.5 rounded-2xl text-white transition-opacity active:scale-[0.95] disabled:opacity-45"
                >
                  <span className="text-[22px] leading-none">{locked ? '🔒' : m.emoji}</span>
                  <span className="px-1 text-center text-[10px] leading-tight font-semibold text-white/80">{locked ? `Fill ${m.unlock}× 💖` : m.label}</span>
                </button>
              )
            })}
          </div>
          <ScrollArrow dir="right" disabled={!canScroll.right} onClick={() => page(1)} />
        </div>
      )}
    </div>
  )
}

function ScrollArrow({ dir, disabled, onClick }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Previous moves' : 'More moves'}
      className="glass grid h-[132px] w-8 shrink-0 place-items-center rounded-2xl text-white/80 transition-opacity active:scale-95 disabled:opacity-20"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  )
}
