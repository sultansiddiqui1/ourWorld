import { useState, type ReactNode } from 'react'
import Universe from '../universe/Universe'

type Tab = 'universe' | 'letters' | 'vending'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'universe',
    label: 'Universe',
    icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />,
  },
  {
    id: 'letters',
    label: 'Open when',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
      </>
    ),
  },
  {
    id: 'vending',
    label: 'Reasons',
    icon: (
      <>
        <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
        <path d="M8 6h8M8 10h8M9 17h6" />
        <circle cx="12" cy="13.5" r="0.6" />
      </>
    ),
  },
]

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('universe')
  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        {/* Universe stays mounted so its 3D scenes don't reload; its render loop pauses when hidden. */}
        <div className={tab === 'universe' ? 'h-full' : 'hidden'}>
          <Universe active={tab === 'universe'} />
        </div>
        {tab === 'letters' && <ComingSoon emoji="💌" title="Open when…" body="Letters you can open (and listen to) when you need them. Coming in Phase 3." />}
        {tab === 'vending' && <ComingSoon emoji="🍬" title="Reasons machine" body="Tap to dispense a reason I love you. Coming in Phase 4." />}
      </main>
      <nav className="relative z-40 border-t border-white/[0.07] bg-night-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="flex">
          {TABS.map((t) => {
            const on = t.id === tab
            return (
              <li key={t.id} className="flex-1">
                <button
                  onClick={() => setTab(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${on ? 'text-blush' : 'text-white/45'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {t.icon}
                  </svg>
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function ComingSoon({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <p className="text-5xl">{emoji}</p>
      <h2 className="font-display mt-4 text-2xl text-white">{title}</h2>
      <p className="mt-2 text-sm text-white/55">{body}</p>
    </div>
  )
}
