import { Line } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Line2 } from 'three-stdlib'
import type { ProjectedConstellation } from '../../lib/constellations'
import { GlowPoints, hexToRgb } from './GlowPoints'
import { AnchorFlare } from './skyParts'

interface Props {
  figure: ProjectedConstellation
  position: [number, number, number]
  scale: number
  /** DOM element (outside the canvas) that this figure's label is pinned to every frame. */
  labelEl: HTMLElement | null
  delay?: number
  selected?: boolean
  onSelect: () => void
}

/** A real constellation: glowing stars, softly drawn lines, a pulsing anchor star and a tap target. */
export function Constellation({ figure, position, scale, labelEl, delay = 0, selected, onSelect }: Props) {
  const { data, points, bounds } = figure
  const starMat = useRef<THREE.ShaderMaterial>(null)
  const flareMat = useRef<THREE.ShaderMaterial>(null)
  const lineRefs = useRef<(Line2 | null)[]>([])
  const labelAnchor = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // Pin the HTML label under the figure (cheaper and StrictMode-safe compared to drei <Html>).
  useFrame(({ camera, size }) => {
    if (!labelEl || !labelAnchor.current) return
    tmp.setFromMatrixPosition(labelAnchor.current.matrixWorld).project(camera)
    const x = (tmp.x * 0.5 + 0.5) * size.width
    const y = (-tmp.y * 0.5 + 0.5) * size.height
    labelEl.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  })

  const stars = useMemo(() => {
    const n = data.stars.length
    const positions = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    const colors = new Float32Array(n * 3)
    const twinkle = new Float32Array(n)
    const tint = hexToRgb(data.tint)
    data.stars.forEach((s, i) => {
      positions.set([points[i][0], points[i][1], 0], i * 3)
      // brighter (lower magnitude) → bigger
      sizes[i] = Math.max(6, (6.2 - s.mag) * 5.2) * (data.loose?.includes(i) ? 0.75 : 1)
      const c = i === data.anchor ? hexToRgb(data.anchorColor) : tint
      colors.set(c, i * 3)
      twinkle[i] = i === data.anchor ? 0.1 : 0.3
    })
    return { positions, sizes, colors, twinkle }
  }, [data, points])

  const segments = useMemo(
    () => data.lines.map(([a, b]) => [new THREE.Vector3(points[a][0], points[a][1], 0), new THREE.Vector3(points[b][0], points[b][1], 0)]),
    [data, points],
  )

  // Reveal: stars fade in, then the lines draw one after another.
  useEffect(() => {
    const tl = gsap.timeline({ delay })
    if (starMat.current) tl.fromTo(starMat.current.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 1.6, ease: 'power2.out' })
    if (flareMat.current) tl.fromTo(flareMat.current.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 1.4, ease: 'power2.out' }, '<0.3')
    lineRefs.current.forEach((l, i) => {
      if (l) tl.fromTo(l.material, { opacity: 0 }, { opacity: 0.38, duration: 0.5, ease: 'sine.out' }, 0.9 + i * 0.12)
    })
    return () => {
      tl.kill()
    }
  }, [delay])

  // Highlight the figure when its card is open.
  useEffect(() => {
    lineRefs.current.forEach((l) => l && gsap.to(l.material, { opacity: selected ? 0.75 : 0.38, linewidth: selected ? 1.8 : 1.1, duration: 0.5 }))
  }, [selected])

  const w = bounds.maxX - bounds.minX + 0.9
  const h = bounds.maxY - bounds.minY + 0.9
  const cx = (bounds.maxX + bounds.minX) / 2
  const cy = (bounds.maxY + bounds.minY) / 2

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <group position={position}>
      {segments.map((seg, i) => (
        <Line
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el as Line2 | null
          }}
          points={seg}
          color={data.tint}
          lineWidth={1.1}
          transparent
          opacity={0}
          depthWrite={false}
        />
      ))}
      <GlowPoints {...stars} opacity={0} scale={scale} materialRef={starMat} />
      <group position={[figure.anchor[0], figure.anchor[1], 0.01]}>
        <AnchorFlare color={data.anchorColor} size={2.4 * scale} phase={data.id === 'virgo' ? 0 : 2} materialRef={flareMat} />
      </group>
      <mesh position={[cx, cy, 0]} onClick={handleClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={labelAnchor} position={[cx, bounds.minY - 0.12 * scale, 0]} />
    </group>
  )
}
