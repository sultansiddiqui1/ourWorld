import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GardenDay, Species } from '../../lib/flowers'

export const FLOWERS_URL = '/models/flowers.glb'
useGLTF.preload(FLOWERS_URL)

const STEM_MAT = new THREE.MeshStandardMaterial({ color: '#3f8a52', roughness: 0.8, flatShading: true })
const LEAF_MAT = new THREE.MeshStandardMaterial({ color: '#4fa063', roughness: 0.75, flatShading: true, side: THREE.DoubleSide })
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
const HIT_GEO = new THREE.BoxGeometry(0.6, 1.3, 0.6).translate(0, 0.7, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const FACE_TILT: Record<Species, number> = { daisy: 0.6, cosmos: 0.6, lotus: 0.45, sayapatri: 0.5, rose: 0.35, tulip: 0.15, gurans: 0.3 }

const prepared = new WeakMap<THREE.Object3D, Partial<Record<Species, THREE.Object3D>>>()

/** Darken each petal toward its base with vertex colours (computed once per shared geometry). */
function gradePetal(geo: THREE.BufferGeometry) {
  if (geo.getAttribute('color')) return
  const pos = geo.getAttribute('position')
  let max = 0
  for (let i = 0; i < pos.count; i++) max = Math.max(max, Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)))
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) / (max || 1)
    const v = 0.5 + 0.5 * Math.pow(t, 0.6)
    colors.set([v, v, v], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function prototypes(scene: THREE.Object3D) {
  let protos = prepared.get(scene)
  if (protos) return protos
  protos = {}
  for (const root of scene.children) {
    root.position.set(0, 0, 0)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.userData.part === 'petal') gradePetal(m.geometry)
    })
    protos[root.name as Species] = root
  }
  prepared.set(scene, protos)
  return protos
}

interface PetalRef {
  obj: THREE.Object3D
  base: THREE.Quaternion
  delta: number
}

interface FlowerProps {
  day: GardenDay
  x: number
  y: number
  focused: boolean
  /** Play the grow-and-open animation on mount. */
  bloom: boolean
  onTap: (index: number) => void
}

export function Flower({ day, x, y, focused, bloom, onTap }: FlowerProps) {
  const { scene } = useGLTF(FLOWERS_URL)
  const proto = prototypes(scene)[day.species]

  const { root, petals, petalMat, centerMat } = useMemo(() => {
    const petalMat = new THREE.MeshStandardMaterial({
      color: day.petal,
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: 0.6,
      emissive: day.petal,
      emissiveIntensity: 0.06,
    })
    const centerMat = new THREE.MeshStandardMaterial({ color: day.center, flatShading: true, roughness: 0.5, emissive: day.center, emissiveIntensity: 0.15 })
    const root = proto ? proto.clone(true) : new THREE.Group()
    const petals: PetalRef[] = []
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      switch (m.userData.part) {
        case 'petal':
          m.material = petalMat
          petals.push({ obj: m, base: m.quaternion.clone(), delta: m.userData.bloomDelta ?? 0.6 })
          break
        case 'center':
          m.material = centerMat
          break
        case 'stem':
          m.material = STEM_MAT
          break
        case 'leaf':
          m.material = LEAF_MAT
          break
      }
    })
    // Face the bloom toward the viewer: flat flowers are unreadable edge-on.
    const head = root.children.find((c) => c.userData.part === 'head')
    if (head) head.rotation.x += FACE_TILT[day.species]
    return { root, petals, petalMat, centerMat }
  }, [proto, day.petal, day.center, day.species])

  useEffect(
    () => () => {
      petalMat.dispose()
      centerMat.dispose()
    },
    [petalMat, centerMat],
  )

  // grow: 0 → 1 scales the plant up from the soil; open: 0 → 1 unfurls the petals.
  const anim = useRef({ grow: bloom ? 0 : 1, open: bloom ? 0 : 1, glow: 0, lastOpen: -1 })
  useEffect(() => {
    if (!bloom) return
    const s = anim.current
    const tl = gsap.timeline({ delay: 1.2 })
    tl.to(s, { grow: 1, duration: 1.6, ease: 'back.out(1.4)' })
      .to(s, { open: 1, duration: 2.8, ease: 'elastic.out(1, 0.45)' }, '-=0.5')
      .fromTo(s, { glow: 1 }, { glow: 0, duration: 2.5, ease: 'sine.out' }, '<')
    return () => {
      tl.kill()
    }
  }, [bloom])

  const group = useRef<THREE.Group>(null)
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const s = anim.current
    const t = clock.elapsedTime
    g.scale.setScalar(Math.max(0.001, s.grow) * day.size)
    g.rotation.z = day.lean + Math.sin(t * 0.8 + day.phase) * 0.035
    g.rotation.x = Math.sin(t * 0.55 + day.phase * 1.7) * 0.02
    if (s.open !== s.lastOpen) {
      for (const p of petals) {
        q.setFromAxisAngle(Z_AXIS, p.delta * (1 - s.open))
        p.obj.quaternion.copy(p.base).multiply(q)
      }
      s.lastOpen = s.open
    }
    const target = (focused ? 0.2 : 0.05) + s.glow * 0.6
    petalMat.emissiveIntensity = THREE.MathUtils.damp(petalMat.emissiveIntensity, target, 4, dt)
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 10) return // it was a swipe, not a tap
    e.stopPropagation()
    onTap(day.index)
  }

  return (
    <group ref={group} position={[x, y, day.z]} rotation={[0, (day.phase - Math.PI) * 0.12, 0]}>
      <primitive object={root} />
      <mesh geometry={HIT_GEO} material={HIT_MAT} onClick={handleClick} />
    </group>
  )
}
