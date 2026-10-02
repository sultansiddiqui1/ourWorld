import { lazy, Suspense, useEffect, useState } from 'react'
import { isUnlocked, PasscodeGate } from './components/gate/PasscodeGate'
import { Welcome } from './components/welcome/Welcome'

// The 3D app is a separate chunk; it downloads while the gate / welcome screen is showing.
const loadShell = () => import('./components/shell/AppShell')
const AppShell = lazy(loadShell)

type Stage = 'gate' | 'welcome' | 'app'

export default function App() {
  const [stage, setStage] = useState<Stage>(() => (isUnlocked() ? 'welcome' : 'gate'))

  useEffect(() => {
    void loadShell()
  }, [])

  return (
    <div className="mx-auto h-dvh max-w-[480px] overflow-hidden bg-night-950">
      {stage === 'gate' && <PasscodeGate onUnlock={() => setStage('welcome')} />}
      {stage === 'welcome' && <Welcome onEnter={() => setStage('app')} />}
      {stage === 'app' && (
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-white/40">opening the sky…</div>}>
          <div className="fade-in h-full">
            <AppShell />
          </div>
        </Suspense>
      )}
    </div>
  )
}
