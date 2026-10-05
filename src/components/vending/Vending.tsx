import { useRef, useState } from 'react'
import { collection, draw, loadDraw, type Pull } from '../../lib/reasonDraw'
import { Sheet } from '../ui/Sheet'
import VendingScene, { type VendingApi } from './VendingScene'

type Phase = 'idle' | 'dispensing' | 'reveal'

export default function Vending({ active }: { active: boolean }) {
  const api = useRef<VendingApi>(null)
  const [state, setState] = useState(loadDraw)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pull, setPull] = useState<Pull | null>(null)
  const [showCollection, setShowCollection] = useState(false)
  const col = collection(state)
  const found = col.normal.length + col.golden.length

  const dispense = async () => {
    if (phase !== 'idle' || !api.current) return
    api.current.press()
    const res = draw(state) // saved immediately, so closing the app mid-animation can't lose it
    setPhase('dispensing')
    await api.current.dispense(res.pull.golden)
    setState(res.state) // the counter ticks up at the reveal, not before
    setPull(res.pull)
    setPhase('reveal')
  }

  const done = () => {
    api.current?.reset()
    setPull(null)
    setPhase('idle')
  }

  return (
    <div className="relative h-full touch-none">
      <VendingScene apiRef={api} active={active} onButton={dispense} />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <div>
          <p className="text-[11px] tracking-[0.25em] text-white/50 uppercase">The reasons machine</p>
          <h1 className="font-display text-[24px] leading-tight text-white">Why I love you</h1>
        </div>
        <button
          onClick={() => setShowCollection(true)}
          className="glass pointer-events-auto mt-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/85 active:scale-95"
        >
          ♡ {found}/{col.total}
        </button>
      </header>

      <p className="pointer-events-none absolute inset-x-0 bottom-[84px] text-center text-[11px] tracking-wider text-white/40">
        pull the lever ↓ or press the button
      </p>
      <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
        <button
          onClick={dispense}
          disabled={phase !== 'idle'}
          className="h-14 w-full max-w-[300px] rounded-full bg-blush text-[16px] font-bold text-night-950 shadow-[0_0_30px_rgba(247,168,196,0.45)] transition-all active:scale-[0.97] disabled:opacity-50 disabled:shadow-none"
        >
          {phase === 'dispensing' ? 'Dispensing…' : 'Dispense a reason'}
        </button>
      </div>

      {phase === 'reveal' && pull && <ReasonCard pull={pull} onDone={done} />}

      <Sheet open={showCollection} onClose={() => setShowCollection(false)} label="Reasons collected">
        <h2 className="font-display text-xl text-white">Reasons you’ve found</h2>
        <p className="text-sm text-white/50">
          {found} of {col.total} · keep pulling to find them all
        </p>
        <ul className="mt-4 space-y-2">
          {col.golden.map((t, i) => (
            <li key={`g${i}`} className="rounded-2xl border border-[#ffd76a]/40 bg-[#ffd76a]/10 px-4 py-3 text-[14px] text-[#ffe9a8]">
              ✦ {t}
            </li>
          ))}
          {col.normal.map((t, i) => (
            <li key={i} className="rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] text-white/85">
              <span className="mr-2 text-blush/80">#{i + 1}</span>
              {t}
            </li>
          ))}
          {found === 0 && <li className="text-sm text-white/40">Nothing yet — press the button!</li>}
        </ul>
      </Sheet>
    </div>
  )
}

function ReasonCard({ pull, onDone }: { pull: Pull; onDone: () => void }) {
  const gold = pull.golden
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 px-5 pb-24" onClick={onDone}>
      <div
        className={`card-pop w-full max-w-[360px] rounded-[26px] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.5)] ${
          gold ? 'bg-gradient-to-br from-[#fff3c4] to-[#ffd76a] text-[#4a3200]' : 'bg-[#fff8ef] text-[#3d2b35]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-[11px] font-bold tracking-[0.22em] uppercase ${gold ? 'text-[#8a5a00]' : 'text-[#c2547f]'}`}>
          {gold ? '✦ Golden capsule ✦' : `Reason #${pull.number}`}
          {!gold && !pull.isNew && ' · again'}
        </p>
        <p className="font-hand mt-3 text-[30px] leading-[1.15]">{pull.text}</p>
        <button
          onClick={onDone}
          className={`mt-5 h-12 w-full rounded-2xl text-sm font-bold active:scale-[0.98] ${gold ? 'bg-[#4a3200] text-[#ffe9a8]' : 'bg-[#c2547f] text-white'}`}
        >
          {gold ? 'Keep this one forever' : 'Aww ♡'}
        </button>
      </div>
    </div>
  )
}
