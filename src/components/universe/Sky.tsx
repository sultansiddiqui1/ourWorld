import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { config } from '../../content/config'
import { CONSTELLATIONS, project, type ConstellationId } from '../../lib/constellations'
import { formatBirthday } from '../../lib/dates'
import { Constellation } from './Constellation'
import { BackgroundStars, LightBridge, Nebula, ShootingStar } from './skyParts'

interface SkyProps {
  active: boolean
  selected: ConstellationId | null
  onSelect: (id: ConstellationId | null) => void
}

export default function Sky({ active, selected, onSelect }: SkyProps) {
  const [labelA, setLabelA] = useState<HTMLDivElement | null>(null)
  const [labelB, setLabelB] = useState<HTMLDivElement | null>(null)
  const [a, b] = config.people
  return (
    <div className="absolute inset-0">
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 10], fov: 50 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelect(null)}
    >
      <SkyScene selected={selected} onSelect={onSelect} labelA={labelA} labelB={labelB} />
    </Canvas>
      <Label el={setLabelA} id={a.constellation} name={a.name} birthday={a.birthday} />
      <Label el={setLabelB} id={b.constellation} name={b.name} birthday={b.birthday} />
    </div>
  )
}

function Label({ el, id, name, birthday }: { el: (e: HTMLDivElement | null) => void; id: ConstellationId; name: string; birthday: string }) {
  const c = CONSTELLATIONS[id]
  return (
    <div ref={el} className="constellation-label pointer-events-none absolute top-0 left-0 will-change-transform" style={{ transform: 'translate(-200px, -200px)' }}>
      <span className="font-display text-[13px] tracking-[0.2em] text-white/85 uppercase">
        {c.symbol}
        {'\uFE0E'} {c.name}
      </span>
      <span className="block text-[10px] tracking-wider whitespace-nowrap text-white/45">
        {name ? `${name} · ` : ''}
        {formatBirthday(birthday)}
      </span>
    </div>
  )
}

function SkyScene({ selected, onSelect, labelA, labelB }: Omit<SkyProps, 'active'> & { labelA: HTMLElement | null; labelB: HTMLElement | null }) {
  const viewport = useThree((s) => s.viewport)
  const { width: w, height: h } = viewport.getCurrentViewport(undefined, [0, 0, 0])
  const scale = Math.min(w / 8.6, h / 7.6, 1.2)
  const unitsPerDeg = 0.1 * scale

  const [a, b] = config.people
  const figA = useMemo(() => project(CONSTELLATIONS[a.constellation], unitsPerDeg), [a.constellation, unitsPerDeg])
  const figB = useMemo(() => project(CONSTELLATIONS[b.constellation], unitsPerDeg), [b.constellation, unitsPerDeg])

  // Figure A up-left, figure B down-right, so the bridge spans the whole sky.
  const posA: [number, number, number] = [-w * 0.1, h * 0.2, 0]
  const posB: [number, number, number] = [w * 0.2, -h * 0.2, 0]
  const anchorA = useMemo<[number, number, number]>(() => [posA[0] + figA.anchor[0], posA[1] + figA.anchor[1], 0], [posA[0], posA[1], figA])
  const anchorB = useMemo<[number, number, number]>(() => [posB[0] + figB.anchor[0], posB[1] + figB.anchor[1], 0], [posB[0], posB[1], figB])


  // Gentle parallax that follows the finger / mouse, plus a slow drift.
  const rig = useRef<THREE.Group>(null)
  const field = useRef<THREE.Group>(null)
  useFrame(({ pointer, clock }, dt) => {
    const t = clock.elapsedTime
    if (rig.current) {
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, pointer.x * 0.06, 2, dt)
      rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, -pointer.y * 0.05, 2, dt)
      rig.current.position.y = Math.sin(t * 0.25) * 0.06
    }
    if (field.current) field.current.rotation.z = t * 0.004
  })

  return (
    <>
      <Nebula />
      <group ref={field}>
        <BackgroundStars />
      </group>
      <ShootingStar area={[w, h]} />
      <group ref={rig}>
        <Constellation
          figure={figA}
          position={posA}
          scale={scale}
          labelEl={labelA}
          delay={0.3}
          selected={selected === a.constellation}
          onSelect={() => onSelect(a.constellation)}
        />
        <Constellation
          figure={figB}
          position={posB}
          scale={scale}
          labelEl={labelB}
          delay={1.1}
          selected={selected === b.constellation}
          onSelect={() => onSelect(b.constellation)}
        />
        <LightBridge
          from={anchorA}
          to={anchorB}
          colorA={CONSTELLATIONS[a.constellation].anchorColor}
          colorB={CONSTELLATIONS[b.constellation].anchorColor}
          scale={scale}
        />
      </group>
    </>
  )
}
