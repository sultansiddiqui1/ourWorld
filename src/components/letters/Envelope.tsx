import type { CSSProperties } from 'react'

interface EnvelopeProps {
  color: string
  emoji: string
  /** Already read: the seal shows as broken. */
  opened?: boolean
  /** Prefix for animation hook classes (e.g. "lv" → .lv-flap, .lv-paper, .lv-seal). */
  hook?: string
  className?: string
}

const FLAP = 'polygon(1.5% 0, 98.5% 0, 50% 93%)'

/**
 * Pure-CSS envelope: back panel, a letter tucked inside, the front pocket,
 * a top flap that can rotate open in 3D, and a wax seal.
 */
export function Envelope({ color, emoji, opened, hook = 'env', className = '' }: EnvelopeProps) {
  const vars = { '--env': color } as CSSProperties
  return (
    <div className={`relative aspect-[4/3] w-full [perspective:900px] ${className}`} style={vars}>
      {/* back */}
      <div className="absolute inset-0 rounded-[10px] bg-[var(--env)] brightness-[0.82]" />
      {/* the letter inside */}
      <div className={`${hook}-paper absolute inset-x-[7%] top-[6%] bottom-[5%] z-[1] rounded-[6px] bg-[#fff8ef] shadow-sm`}>
        <div className="mx-[12%] mt-[14%] space-y-[7%]">
          {[90, 75, 82, 60].map((w, i) => (
            <div key={i} className="h-[3px] rounded-full bg-[#c2547f]/20" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      {/* front pocket: side + bottom flaps */}
      <div
        className="absolute inset-0 z-[2] rounded-[10px] bg-[var(--env)] shadow-[inset_0_-10px_20px_rgba(0,0,0,0.08)]"
        style={{ clipPath: 'polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%)' }}
      />
      <div
        className="absolute inset-0 z-[2] rounded-[10px] opacity-60"
        style={{
          clipPath: 'polygon(0 0, 50% 56%, 0 100%)',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.25), transparent)',
        }}
      />
      {/* top flap: outside face + darker inside face, folds open in 3D */}
      <div className={`${hook}-flap absolute inset-x-0 top-0 z-[3] h-[60%] origin-top [transform-style:preserve-3d]`}>
        <div
          className="absolute inset-0 bg-[var(--env)] brightness-[1.06] [backface-visibility:hidden]"
          style={{ clipPath: FLAP, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.15))' }}
        />
        <div
          className="absolute inset-0 bg-[var(--env)] brightness-[0.72] [backface-visibility:hidden] [transform:rotateX(180deg)]"
          style={{ clipPath: FLAP }}
        />
      </div>
      {/* wax seal */}
      <div
        className={`${hook}-seal absolute top-[56%] left-1/2 z-[4] grid aspect-square w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[min(5vw,20px)] shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_-3px_6px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.3)] ${opened ? 'opacity-40 grayscale-[0.6]' : ''}`}
        style={{ background: 'radial-gradient(circle at 35% 30%, #e0546f, #a3203d 70%)' }}
      >
        <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">{emoji}</span>
      </div>
    </div>
  )
}
