import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState, type ReactNode } from 'react'

gsap.registerPlugin(useGSAP)

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
}

/** Bottom sheet that slides up over the current tab. Stays mounted until its exit animation ends. */
export function Sheet({ open, onClose, children, label }: SheetProps) {
  const root = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useGSAP(
    () => {
      if (!mounted) return
      if (open) {
        gsap.fromTo('.sheet-backdrop', { opacity: 0 }, { opacity: 1, duration: 0.35 })
        gsap.fromTo('.sheet-panel', { yPercent: 100 }, { yPercent: 0, duration: 0.55, ease: 'power3.out' })
      } else {
        gsap.to('.sheet-backdrop', { opacity: 0, duration: 0.25 })
        gsap.to('.sheet-panel', { yPercent: 100, duration: 0.35, ease: 'power2.in', onComplete: () => setMounted(false) })
      }
    },
    { scope: root, dependencies: [open, mounted] },
  )

  if (!mounted) return null
  return (
    <div ref={root} className="absolute inset-0 z-30" role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-night-800/95 px-6 pt-3 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
        {children}
        <button onClick={onClose} className="mt-6 h-12 w-full rounded-2xl bg-white/10 text-sm font-semibold text-white/80 active:bg-white/15">
          Close
        </button>
      </div>
    </div>
  )
}
