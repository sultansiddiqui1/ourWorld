import { Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GardenDay } from '../../lib/flowers'
import { Flower } from './Flower'
import { groundHeight, Meadow, Ridge } from './gardenTerrain'
import { BackgroundStars } from './skyParts'

export const SPACING = 0.92
export const CAMERA = { position: [0, 1.0, 3.4] as [number, number, number], fov: 40, lookAt: [0, 0.78, 0] as [number, number, number] }
const NIGHT = '#0b0e26'
const CHUNK = 20
/** Flowers rendered either side of the focused one. */
const WINDOW = 5

export interface ScrollState {
  /** Fractional index of the flower at the centre of the screen. */
  v: number
}

interface GardenProps {
  days: GardenDay[]
  scroll: ScrollState
  focus: number
  active: boolean
  bloomToday: boolean
  onFocus: (index: number) => void
  onTap: (index: number) => void
}

export default function Garden(props: GardenProps) {
  return (
    <Canvas
      frameloop={props.active ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(...CAMERA.lookAt)}
    >
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 6, 26]} />
      <GardenScene {...props} />
    </Canvas>
  )
}

function GardenScene({ days, scroll, focus, bloomToday, onFocus, onTap }: GardenProps) {
  const world = useRef<THREE.Group>(null)
  const [chunk, setChunk] = useState(() => Math.round((scroll.v * SPACING) / CHUNK) * CHUNK)
  const lastFocus = useRef(focus)

  useFrame(() => {
    const wx = scroll.v * SPACING
    if (world.current) world.current.position.x = -wx
    const c = Math.round(wx / CHUNK) * CHUNK
    if (c !== chunk) setChunk(c)
    const f = THREE.MathUtils.clamp(Math.round(scroll.v), 0, days.length - 1)
    if (f !== lastFocus.current) {
      lastFocus.current = f
      onFocus(f)
    }
  })

  const lo = Math.max(0, focus - WINDOW)
  const hi = Math.min(days.length - 1, focus + WINDOW)
  const visible = days.slice(lo, hi + 1)
  const last = days.length - 1

  return (
    <>
      <hemisphereLight args={['#9b97ff', '#0d2318', 0.9]} />
      <directionalLight position={[-3, 5, 3]} intensity={1.6} color="#e4e6ff" />
      <pointLight position={[0, 1.5, 0.9]} intensity={5} distance={2.6} decay={1.4} color="#ffd0e2" />
      <group position={[0, 2.2, 0]}>
        <BackgroundStars count={260} width={40} height={10} zMin={-30} zMax={-18} seed={7} />
      </group>
      <group ref={world}>
        <Ridge center={chunk} z={-12} jagged color="#262d66" snow="#d2d8f7" />
        <Ridge center={chunk} z={-5} jagged={false} color="#0d1a2b" />
        <Meadow center={chunk} />
        <Suspense fallback={null}>
          {visible.map((d) => (
            <Flower
              key={d.key}
              day={d}
              x={d.index * SPACING}
              y={groundHeight(d.index * SPACING, d.z) - 0.02}
              focused={d.index === focus}
              bloom={bloomToday && d.index === last}
              onTap={onTap}
            />
          ))}
        </Suspense>
      </group>
      <Sparkles count={36} scale={[7, 1.6, 3]} position={[0, 0.9, 0]} size={3.2} speed={0.35} opacity={0.85} color="#ffe6a0" noise={1} />
      <ResizeFix />
    </>
  )
}

/** Keep the framing when the canvas changes size (rotation, tab switch). */
function ResizeFix() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    camera.lookAt(...CAMERA.lookAt)
  }, [camera, size])
  return null
}
