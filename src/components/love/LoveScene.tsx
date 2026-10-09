import { Sparkles, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { Ridge } from '../universe/gardenTerrain'

const ME = '/models/me.glb'
const HER = '/models/her.glb'
const FLOWERS = '/models/flowers.glb'
useGLTF.preload(ME)
useGLTF.preload(HER)
if (import.meta.env.DEV) (window as unknown as { gsap: typeof gsap }).gsap = gsap

export type Who = 'him' | 'her'
export type Outfit = 'everyday' | 'festive' | 'pyjamas' | 'couple'
export type SceneId = 'night' | 'sunset' | 'beach' | 'himalaya'
export interface Touch {
  who: Who
  zone: string
  clientX: number
  clientY: number
}

/** Every couple animation resolves when it has finished playing. */
export interface LoveApi {
  pat: () => Promise<void>
  cheekKiss: () => Promise<void>
  herKiss: () => Promise<void>
  hug: () => Promise<void>
  spin: () => Promise<void>
  giggle: () => Promise<void>
  flex: () => Promise<void>
  holdHands: () => Promise<void>
  foreheadKiss: () => Promise<void>
  dance: () => Promise<void>
  celebrate: () => Promise<void>
  flower: () => Promise<void>
  heart: () => Promise<void>
  slowDance: () => Promise<void>
  /** Poses for a selfie; `onSnap` receives a JPEG data-URL of the moment the flash goes off. */
  selfie: (onSnap: (url: string) => void) => Promise<void>
  nap: () => Promise<void>
  feed: () => Promise<void>
  tickle: () => Promise<void>
  /** A small unprompted moment (glance, lean, poke, yawn, wave). */
  idle: () => Promise<void>
  /** Cut an idle moment short when she presses something. */
  stopIdle: () => void
}

/** Animated offsets per character; added to the rest pose every frame. */
const fresh = () => ({
  x: 0, y: 0, rotY: 0, spin: 0, lean: 0, leanX: 0, headX: 0, headZ: 0,
  armLx: 0, armLz: 0, armRx: 0, armRz: 0, elbowLx: 0, elbowRx: 0, elbowLz: 0, elbowRz: 0,
  blush: 0, happy: 0, pucker: 0, mouthOpen: 0, flex: 0, bob: 0, fall: 0, sleep: 0, puff: 0, laugh: 0,
  /** 1 during kisses/hugs: lets the heads actually meet instead of stopping short. */
  contact: 0,
})
type Fx = ReturnType<typeof fresh>

interface Rig {
  root: THREE.Object3D
  torso: THREE.Object3D
  head: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  elbowL: THREE.Object3D
  elbowR: THREE.Object3D
  eyes: THREE.Object3D[]
  rest: Map<THREE.Object3D, THREE.Euler>
  parts: (p: string) => THREE.Object3D[]
  mats: Map<string, THREE.MeshStandardMaterial>
  original: Map<string, string>
}

/** Find the jointed parts, and give this copy its own materials so outfit colours don't leak into other tabs. */
function rigOf(scene: THREE.Object3D): Rig {
  const map = new Map<string, THREE.Object3D[]>()
  const mats = new Map<string, THREE.MeshStandardMaterial>()
  scene.traverse((o) => {
    const p = o.userData.part as string | undefined
    if (p) map.set(p, [...(map.get(p) ?? []), o])
    const m = o as THREE.Mesh
    if (m.isMesh) {
      // idempotent: React (StrictMode) may build this twice on the same clone — never re-clone
      if (!m.userData.ownMaterial) {
        const src = m.material as THREE.MeshStandardMaterial
        if (!mats.has(src.name)) mats.set(src.name, src.clone())
        m.material = mats.get(src.name)!
        m.userData.ownMaterial = true
      } else {
        const own = m.material as THREE.MeshStandardMaterial
        mats.set(own.name, own)
      }
    }
  })
  const parts = (p: string) => map.get(p) ?? []
  const one = (p: string) => parts(p)[0]
  const rig: Rig = {
    root: one('root'), torso: one('torso'), head: one('head'), armL: one('armL'), armR: one('armR'),
    elbowL: one('elbowL'), elbowR: one('elbowR'), eyes: parts('eye'), rest: new Map(), parts, mats,
    original: new Map([...mats].map(([k, m]) => [k, (m.userData.original ??= '#' + m.color.getHexString()) as string])),
  }
  for (const o of [rig.torso, rig.head, rig.armL, rig.armR, rig.elbowL, rig.elbowR]) rig.rest.set(o, o.rotation.clone())
  return rig
}

const OUTFITS: Record<Exclude<Outfit, 'everyday'>, { him: Record<string, string>; her: Record<string, string> }> = {
  festive: { him: { Shirt: '#7a1f2b', Placket: '#d4a33a', Pants: '#f1e7d6' }, her: { HerTop: '#b3122e', HerPants: '#c9973a' } },
  pyjamas: { him: { Shirt: '#a9c2ee', Placket: '#ffffff', Pants: '#7d9be0' }, her: { HerTop: '#f6b3c8', HerPants: '#ee93b6' } },
  couple: { him: { Shirt: '#ff7aa2', Placket: '#ffffff', Pants: '#3d5a8a' }, her: { HerTop: '#ff7aa2', HerPants: '#3d5a8a' } },
}

const SCENES: Record<SceneId, { bg: string; floor: string; floorR: number; sky: [string, string, number]; sparkle: string }> = {
  night: { bg: '#2a1533', floor: '#3d2048', floorR: 2.0, sky: ['#fff0f6', '#4a2a55', 1.15], sparkle: '#ff9cc4' },
  sunset: { bg: '#e4806a', floor: '#6b3d4f', floorR: 2.4, sky: ['#ffe0c2', '#7a3d4a', 1.2], sparkle: '#ffd29a' },
  beach: { bg: '#8fd3f4', floor: '#f0d9a5', floorR: 3.2, sky: ['#ffffff', '#e0c9a0', 1.3], sparkle: '#ffffff' },
  himalaya: { bg: '#0b0e26', floor: '#2a6142', floorR: 3.2, sky: ['#cdd3ff', '#16301f', 1.0], sparkle: '#e8ecff' },
}

const BASE_ROT = { him: 0.32, her: -0.32 }
/** Their heads are huge spheres (r ≈ 0.42 + hair): never let the centres get closer than "touching". */
const HEAD_CENTER = new THREE.Vector3(0, 0.33, 0) // from the head joint
const MIN_HEAD_GAP = 0.86
const CONTACT_GAP = 0.66 // close enough that lips reach a cheek / foreheads press together
const CAM = { pos: [0, 1.2, 6.1] as [number, number, number], look: [0, 0.9, 0] as [number, number, number] }
const HAIR_SPOT = new THREE.Vector3(-0.33, 0.56, 0.16) // her right side, mirroring the flower she already wears

interface SceneProps {
  apiRef: Ref<LoveApi>
  active: boolean
  love: number
  outfit: Outfit
  scene: SceneId
  onTouch: (t: Touch, kind: 'tap' | 'long' | 'swipe') => void
}

/** Shared animated lighting/props state (driven by GSAP, read every frame). */
const makeEnv = () => ({ dim: 0, spot: 0, heart: 0, orbit: 0, flower: 0 })
type Env = ReturnType<typeof makeEnv>

export default function LoveScene(props: SceneProps) {
  const env = useRef(makeEnv()).current
  const sc = SCENES[props.scene]
  return (
    <Canvas frameloop={props.active ? 'always' : 'never'} dpr={[1, 2]} camera={{ position: CAM.pos, fov: 38 }} onCreated={({ camera }) => camera.lookAt(...CAM.look)}>
      <color attach="background" args={[sc.bg]} />
      <Lights env={env} sky={sc.sky} />
      <Backdrop id={props.scene} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[sc.floorR, 56]} />
        <meshStandardMaterial color={sc.floor} roughness={0.95} />
      </mesh>
      <Sparkles key={props.scene} count={40} scale={[4, 2.6, 2]} position={[0, 1.3, -0.5]} size={4} speed={0.3} color={sc.sparkle} opacity={0.7} />
      <Suspense fallback={null}>
        <Couple {...props} env={env} />
      </Suspense>
    </Canvas>
  )
}

function Lights({ env, sky }: { env: Env; sky: [string, string, number] }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const spot = useRef<THREE.SpotLight>(null)
  useFrame(() => {
    const k = 1 - env.dim * 0.7
    if (hemi.current) hemi.current.intensity = sky[2] * k
    if (key.current) key.current.intensity = 1.7 * k
    if (rim.current) rim.current.intensity = 0.9 * k
    if (spot.current) spot.current.intensity = env.spot * 40
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={[sky[0], sky[1], sky[2]]} />
      <directionalLight ref={key} position={[1.5, 3, 3]} intensity={1.7} color="#fff3ee" />
      <directionalLight ref={rim} position={[-2.5, 1.5, -1]} intensity={0.9} color="#ffb3d1" />
      <spotLight ref={spot} position={[0, 4.5, 2]} angle={0.42} penumbra={0.6} intensity={0} color="#ffe2ef" distance={12} />
    </>
  )
}

/** Scenery behind them. */
function Backdrop({ id }: { id: SceneId }) {
  if (id === 'sunset')
    return (
      <group>
        <mesh position={[0.8, 1.5, -7]}>
          <circleGeometry args={[1.3, 48]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
        {[-3, -2.2, -1.5, -0.6, 0.3, 1.2, 2.1, 2.9].map((x, i) => (
          <mesh key={i} position={[x, 0.4 + (i % 3) * 0.35, -5]}>
            <boxGeometry args={[0.7, 0.8 + (i % 3) * 0.7, 0.3]} />
            <meshBasicMaterial color="#5a2a3f" />
          </mesh>
        ))}
      </group>
    )
  if (id === 'beach')
    return (
      <group>
        <mesh position={[0, 0.02, -4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[30, 5]} />
          <meshStandardMaterial color="#3fa7d6" roughness={0.3} />
        </mesh>
        <mesh position={[1.6, 2.4, -8]}>
          <circleGeometry args={[0.9, 40]} />
          <meshBasicMaterial color="#fff4b8" />
        </mesh>
      </group>
    )
  if (id === 'himalaya')
    return (
      <group position={[0, 0, 0]}>
        <Ridge center={0} z={-9} jagged color="#262d66" snow="#d2d8f7" />
        <Ridge center={0} z={-4.5} jagged={false} color="#0d1a2b" />
      </group>
    )
  return null
}

function Couple({ apiRef, onTouch, env, love, outfit }: SceneProps & { env: Env }) {
  const meGltf = useGLTF(ME)
  const herGltf = useGLTF(HER)
  const flowersGltf = useGLTF(FLOWERS)
  const { gl, scene, camera } = useThree()
  // clones: the Punch tab and garden use the same cached models
  const him = useMemo(() => meGltf.scene.clone(true), [meGltf.scene])
  const her = useMemo(() => herGltf.scene.clone(true), [herGltf.scene])
  const R = useMemo(() => ({ him: rigOf(him), her: rigOf(her) }), [him, her])
  const F = useRef({ him: fresh(), her: fresh() }).current
  const blink = useRef({ him: { next: 1.5, t: -1 }, her: { next: 2.4, t: -1 } }).current
  const loveRef = useRef(love)
  loveRef.current = love
  const animating = useRef(0)
  const mood = useRef({ on: 1 })
  const idleTl = useRef<gsap.core.Timeline | null>(null)

  // his cheeks don't exist in the model — add soft pink blush that fades in on demand
  const hisBlush = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: '#ff7aa2', transparent: true, opacity: 0, depthWrite: false })
    const g = new THREE.SphereGeometry(0.06, 16, 12)
    ;[1, -1].forEach((sx) => {
      const b = new THREE.Mesh(g, m)
      b.position.set(sx * 0.24, 0.22, 0.315)
      b.scale.set(1.1, 0.65, 0.25)
      R.him.head.add(b)
    })
    return m
  }, [R])

  // ---- props ----
  const props = useMemo(() => {
    // the lali gurans from the garden: full flower in his hand, just the blossom in her hair
    const src = flowersGltf.scene.children.find((c) => c.name === 'gurans')!
    const inHand = src.clone(true)
    inHand.position.set(0, 0, 0)
    inHand.scale.setScalar(0.5)
    inHand.visible = false
    const blossomSrc = src.children.find((c) => c.userData.part === 'head')!
    const inHair = blossomSrc.clone(true)
    inHair.position.copy(HAIR_SPOT)
    inHair.rotation.set(0.5, 0, 0.6)
    inHair.scale.setScalar(0)
    R.her.head.add(inHair)
    const petal = new THREE.MeshStandardMaterial({ color: '#e3173e', roughness: 0.45, emissive: '#e3173e', emissiveIntensity: 0.12, side: THREE.DoubleSide })
    const green = new THREE.MeshStandardMaterial({ color: '#3f8a52', roughness: 0.8, side: THREE.DoubleSide })
    const yellow = new THREE.MeshStandardMaterial({ color: '#ffe08a' })
    for (const root of [inHand, inHair])
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.material = m.userData.part === 'petal' ? petal : m.userData.part === 'center' ? yellow : green
      })

    // phone for the selfie, in his right hand
    const phone = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.012), new THREE.MeshStandardMaterial({ color: '#ff8fb5', roughness: 0.4 }))
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.112), new THREE.MeshBasicMaterial({ color: '#1b1230' }))
    screen.position.z = -0.007
    screen.rotation.y = Math.PI
    phone.add(body, screen)
    phone.position.set(0, -0.24, 0.02)
    phone.visible = false
    R.him.elbowR.add(phone)

    // momos: one in his left hand, one in her right
    const momoMat = new THREE.MeshStandardMaterial({ color: '#f6efe2', roughness: 0.7 })
    const makeMomo = () => {
      const g = new THREE.Group()
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), momoMat)
      bun.scale.set(1, 0.72, 1)
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.03, 8), momoMat)
      knot.position.y = 0.05
      g.add(bun, knot)
      g.scale.setScalar(0)
      return g
    }
    // placed every frame between the feeder's hand and the other one's mouth (see useFrame)
    const hisMomo = makeMomo()
    const herMomo = makeMomo()

    // big glowing heart for "make a heart"
    const s = new THREE.Shape()
    s.moveTo(0, -0.35)
    s.bezierCurveTo(-0.55, 0.0, -0.32, 0.42, 0, 0.18)
    s.bezierCurveTo(0.32, 0.42, 0.55, 0.0, 0, -0.35)
    const heart = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4 }),
      new THREE.MeshStandardMaterial({ color: '#ff4f8b', emissive: '#ff2f72', emissiveIntensity: 0.8, roughness: 0.3 }),
    )
    heart.position.set(0, 1.92, 0.1)
    heart.scale.setScalar(0)
    const out = { inHand, inHair, phone, hisMomo, herMomo, heart, flowerFrom: new THREE.Vector3(), flowerTo: new THREE.Vector3() }
    return out
  }, [R, flowersGltf.scene])

  // hide the "punch game" faces
  useMemo(() => {
    R.him.parts('eyeX').forEach((o) => (o.visible = false))
    R.him.parts('mouthOuch').forEach((o) => (o.visible = false))
    R.her.parts('eyeHappy').forEach((o) => (o.visible = false))
    R.her.parts('mouthOpen').forEach((o) => (o.visible = false))
  }, [R])

  // outfits are recolours of the clothes
  useEffect(() => {
    for (const who of ['him', 'her'] as const) {
      const rig = R[who]
      const palette = outfit === 'everyday' ? undefined : OUTFITS[outfit][who]
      for (const [name, m] of rig.mats) {
        const c = palette?.[name] ?? rig.original.get(name)
        if (c && (palette?.[name] || ['Shirt', 'Placket', 'Pants', 'HerTop', 'HerPants'].includes(name))) m.color.set(c)
      }
    }
  }, [outfit, R])

  const run = (build: (t: gsap.core.Timeline) => void, keep?: (t: gsap.core.Timeline) => void) =>
    new Promise<void>((res) => {
      animating.current++
      const t = gsap.timeline({
        onComplete: () => {
          animating.current--
          res()
        },
      })
      build(t)
      keep?.(t)
    })
  const settle = (t: gsap.core.Timeline, fx: Fx, at: number | string, dur = 0.6) =>
    t.to(fx, { ...Object.fromEntries(Object.keys(fresh()).map((k) => [k, 0])), duration: dur, ease: 'power2.inOut' }, at)
  const both = [F.him, F.her]

  useImperativeHandle(
    apiRef,
    () => ({
      pat: () =>
        run((t) => {
          t.to(F.him, { happy: 1, blush: 1, duration: 0.2 })
            .to(F.him, { headZ: 0.22, bob: 0.06, duration: 0.14, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0)
            .to(F.her, { happy: 1, duration: 0.2 }, 0.1)
          settle(t, F.him, 1.2)
          settle(t, F.her, 1.2)
        }),

      giggle: () =>
        run((t) => {
          t.to(F.her, { happy: 1, mouthOpen: 1, blush: 1, armLx: -1.6, elbowLx: -1.6, duration: 0.25 }) // hand to mouth
            .to(F.her, { bob: 0.05, lean: 0.08, duration: 0.1, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.15)
            .to(F.him, { blush: 0.6, duration: 0.3 }, 0.2)
          settle(t, F.her, 1.3)
          settle(t, F.him, 1.3)
        }),

      cheekKiss: () =>
        run((t) => {
          t.to(F.him, { x: 0.3, rotY: 0.6, lean: -0.22, headZ: -0.2, pucker: 1, contact: 1, duration: 0.5, ease: 'power2.out' })
            .to(F.her, { happy: 1, headZ: -0.15, duration: 0.3 }, 0.35)
            .to(F.her, { blush: 1, duration: 0.3 }, 0.6)
            .to(F.him, { blush: 1, duration: 0.4 }, 0.8)
          settle(t, F.him, 1.4)
          settle(t, F.her, 1.6, 0.8)
        }),

      herKiss: () =>
        run((t) => {
          t.to(F.her, { x: -0.3, rotY: -0.6, lean: 0.22, headZ: 0.2, mouthOpen: 0.4, happy: 1, y: 0.04, contact: 1, duration: 0.5, ease: 'power2.out' })
            .to(F.him, { blush: 1, happy: 1, headZ: 0.18, duration: 0.3 }, 0.55)
            .to(F.him, { bob: 0.08, duration: 0.12, yoyo: true, repeat: 3 }, 0.7)
          settle(t, F.her, 1.4)
          settle(t, F.him, 1.8, 0.8)
        }),

      hug: () =>
        run((t) => {
          const wrap = { armLx: -1.25, armRx: -1.25, elbowLx: -0.9, elbowRx: -0.9, duration: 0.5, ease: 'power2.out' }
          t.to(F.him, { x: 0.25, rotY: 0.95, armLz: -0.35, armRz: 0.35, contact: 1, ...wrap }, 0)
            .to(F.her, { x: -0.25, rotY: -0.95, armLz: -0.35, armRz: 0.35, ...wrap, happy: 1, blush: 1 }, 0)
            .to(F.him, { happy: 1, blush: 0.8, duration: 0.3 }, 0.4)
            .to(both, { lean: 0.07, duration: 0.45, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.55)
          settle(t, F.him, 2.5, 0.7)
          settle(t, F.her, 2.5, 0.7)
        }),

      spin: () =>
        run((t) => {
          t.to(F.him, { armLz: 0.9, x: 0.05, duration: 0.3 })
            .to(F.her, { armRz: -2.4, x: -0.05, happy: 1, mouthOpen: 0.6, duration: 0.3 }, 0)
            .to(F.her, { spin: Math.PI * 2, duration: 1.0, ease: 'power2.inOut' }, 0.3)
            .to(F.her, { y: 0.12, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.out' }, 0.3)
          settle(t, F.him, 1.5)
          settle(t, F.her, 1.5)
          t.set(F.her, { spin: 0 })
        }),

      flex: () =>
        run((t) => {
          t.to(F.him, { flex: 1, headZ: 0.12, duration: 0.45, ease: 'back.out(1.8)' })
            .to(F.her, { happy: 1, blush: 1, mouthOpen: 0.5, duration: 0.3 }, 0.3)
          settle(t, F.him, 1.8)
          settle(t, F.her, 1.8)
        }),

      holdHands: () =>
        run((t) => {
          t.to(F.him, { x: 0.12, armLz: 0.75, rotY: 0.15, duration: 0.6, ease: 'power2.out' })
            .to(F.her, { x: -0.12, armRz: -0.75, rotY: -0.15, happy: 1, blush: 0.7, duration: 0.6, ease: 'power2.out' }, 0)
            .to(both, { bob: 0.03, duration: 0.4, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.6)
            .to(F.him, { happy: 1, duration: 0.3 }, 0.6)
          settle(t, F.him, 3.2)
          settle(t, F.her, 3.2)
        }),

      foreheadKiss: () =>
        run((t) => {
          t.to(F.him, { x: 0.3, rotY: 0.7, lean: -0.25, headX: 0.25, headZ: -0.15, pucker: 1, contact: 1, duration: 0.6, ease: 'power2.out' })
            .to(F.her, { x: -0.18, rotY: -0.7, headX: -0.15, happy: 1, blush: 1, duration: 0.6 }, 0.1)
            .to(F.him, { happy: 1, blush: 0.6, duration: 0.3 }, 0.7)
          settle(t, F.him, 2.4, 0.8)
          settle(t, F.her, 2.6, 0.8)
        }),

      dance: () =>
        run((t) => {
          t.to(both, { happy: 1, duration: 0.2 })
          for (let i = 0; i < 6; i++) {
            const s = i % 2 ? 1 : -1
            t.to(F.him, { lean: 0.18 * s, rotY: 0.32 * s, armLz: 1.8, armRz: -1.8, elbowLz: 0.6 * s, bob: 0.08, duration: 0.33, ease: 'sine.inOut' }, 0.2 + i * 0.36)
            t.to(F.her, { lean: -0.18 * s, rotY: -0.32 * s, armLz: 1.6, armRz: -1.6, elbowRz: -0.6 * s, bob: 0.08, mouthOpen: 0.5, duration: 0.33, ease: 'sine.inOut' }, 0.2 + i * 0.36)
          }
          settle(t, F.him, 2.5)
          settle(t, F.her, 2.5)
        }),

      celebrate: () =>
        run((t) => {
          t.to(both, { y: 0.25, happy: 1, blush: 1, armLz: 2.4, armRz: -2.4, duration: 0.3, ease: 'power2.out' })
            .to(both, { y: 0, duration: 0.35, ease: 'bounce.out' })
            .to(both, { y: 0.18, duration: 0.25, yoyo: true, repeat: 1 })
            .to(F.him, { x: 0.25, rotY: 0.95, armLx: -1.25, armRx: -1.25, armLz: -0.35, armRz: 0.35, elbowLx: -0.9, elbowRx: -0.9, contact: 1, duration: 0.5 })
            .to(F.her, { x: -0.25, rotY: -0.95, armLx: -1.25, armRx: -1.25, armLz: -0.35, armRz: 0.35, elbowLx: -0.9, elbowRx: -0.9, duration: 0.5 }, '<')
            .to(both, { lean: 0.08, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' })
          settle(t, F.him, '+=0.1', 0.8)
          settle(t, F.her, '<', 0.8)
        }),

      // 🌹 he pulls out a lali gurans, she smells it, and it ends up tucked in her hair
      flower: () =>
        run((t) => {
          t.call(() => {
            props.inHand.visible = true
            env.flower = 0
          })
            .to(F.him, { x: 0.16, rotY: 0.55, armLx: -0.95, armLz: 0.45, elbowLx: -0.7, happy: 1, duration: 0.55, ease: 'power2.out' })
            .fromTo(props.inHand.scale, { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5, duration: 0.4, ease: 'back.out(2)' }, 0.1)
            .to(F.her, { happy: 1, mouthOpen: 0.7, blush: 1, armLx: -0.5, elbowLx: -0.8, duration: 0.35 }, 0.55)
            .to(F.her, { headZ: 0.18, headX: 0.1, x: -0.06, duration: 0.4 }, 0.95) // leans in to smell it
            .call(() => {
              // fly from his hand into her hair
              props.inHand.getWorldPosition(props.flowerFrom)
            }, [], 1.7)
            .to(env, { flower: 1, duration: 0.7, ease: 'power2.inOut' }, 1.7)
            .call(() => (props.inHand.visible = false), [], 2.4)
            .fromTo(props.inHair.scale, { x: 0, y: 0, z: 0 }, { x: 0.55, y: 0.55, z: 0.55, duration: 0.5, ease: 'back.out(2.5)' }, 2.35)
          settle(t, F.him, 2.4)
          settle(t, F.her, 2.7)
          t.set(env, { flower: 0 }, '>')
        }),

      // 🫶 inner arms up, hands meet overhead; a glowing heart appears between them
      heart: () =>
        run((t) => {
          t.to(F.him, { x: 0.12, armLz: 2.55, elbowLz: 1.25, happy: 1, duration: 0.6, ease: 'power2.out' })
            .to(F.her, { x: -0.12, armRz: -2.55, elbowRz: -1.25, happy: 1, blush: 1, duration: 0.6, ease: 'power2.out' }, 0)
            .to(props.heart.scale, { x: 0.62, y: 0.62, z: 0.62, duration: 0.6, ease: 'back.out(2)' }, 0.5)
            .to(props.heart.scale, { x: 0.72, y: 0.72, z: 0.72, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.1)
            .to(props.heart.scale, { x: 0, y: 0, z: 0, duration: 0.35, ease: 'back.in(2)' }, 2.5)
          settle(t, F.him, 2.6)
          settle(t, F.her, 2.6)
        }),

      // 💃 lights down, spotlight on, face each other and slowly turn together
      slowDance: () =>
        run((t) => {
          t.to(env, { dim: 1, spot: 1, duration: 0.8 })
            .to(F.him, { x: 0.2, rotY: 1.0, armLx: -1.15, armRx: -1.15, armLz: -0.25, armRz: 0.25, elbowLx: -0.5, elbowRx: -0.5, happy: 1, contact: 0.5, duration: 0.7 }, 0.2)
            .to(F.her, { x: -0.2, rotY: -1.0, armLx: -1.3, armRx: -1.3, armLz: -0.3, armRz: 0.3, elbowLx: -0.4, elbowRx: -0.4, happy: 1, blush: 1, duration: 0.7 }, 0.2)
            .to(env, { orbit: Math.PI * 2, duration: 5.0, ease: 'sine.inOut' }, 0.9)
            .to(both, { lean: 0.06, duration: 0.6, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.9)
            .to(env, { dim: 0, spot: 0, duration: 0.8 }, 5.6)
          settle(t, F.him, 5.7)
          settle(t, F.her, 5.7)
          t.set(env, { orbit: 0 })
        }),

      selfie: (onSnap) =>
        run((t) => {
          t.call(() => (props.phone.visible = true))
            .to(F.him, { x: 0.15, armRz: -1.9, armRx: -0.75, elbowRz: -0.5, lean: -0.08, happy: 1, contact: 0.4, duration: 0.6, ease: 'power2.out' })
            .to(F.her, { x: -0.15, lean: 0.14, headZ: 0.12, happy: 1, mouthOpen: 0.4, blush: 1, armLz: 0.9, elbowLz: 1.2, duration: 0.6, ease: 'power2.out' }, 0) // ✌️-ish
            .call(
              () => {
                // capture this exact frame (explicit render → read the canvas before it's cleared)
                props.phone.visible = false
                gl.render(scene, camera)
                onSnap(gl.domElement.toDataURL('image/jpeg', 0.92))
                props.phone.visible = true
              },
              [],
              1.25,
            )
            .call(() => (props.phone.visible = false), [], 1.9)
          settle(t, F.him, 1.9)
          settle(t, F.her, 1.9)
        }),

      // 😴 she rests her head on his shoulder, he rests his on hers; eyes closed, slow breathing
      nap: () =>
        run((t) => {
          t.to(env, { dim: 0.5, duration: 0.6 })
            .to(F.her, { x: -0.22, rotY: -0.45, lean: 0.12, headZ: 0.38, happy: 1, blush: 0.6, contact: 1, duration: 0.8, ease: 'power2.inOut' }, 0)
            .to(F.him, { x: 0.05, headZ: -0.18, sleep: 1, duration: 0.8, ease: 'power2.inOut' }, 0.2)
            .to(both, { y: -0.012, duration: 1.0, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.9)
            .to(env, { dim: 0, duration: 0.6 }, 4.6)
          settle(t, F.him, 4.6, 0.8)
          settle(t, F.her, 4.6, 0.8)
        }),

      // 🥟 he feeds her a momo, then she feeds him one — cheeks puff while chewing
      feed: () =>
        run((t) => {
          t.to(props.hisMomo.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2)' })
            .to(F.him, { x: 0.22, rotY: 0.6, armLx: -1.9, armLz: 0.5, elbowLx: -0.65, happy: 1, duration: 0.55, ease: 'power2.out' }, 0.1)
            .to(F.her, { mouthOpen: 1, happy: 1, duration: 0.3 }, 0.45)
            .to(props.hisMomo.scale, { x: 0, y: 0, z: 0, duration: 0.15 }, 0.85)
            .to(F.her, { mouthOpen: 0, puff: 1, duration: 0.15 }, 0.85)
            .to(F.her, { puff: 0.4, duration: 0.14, yoyo: true, repeat: 5 }, 1.0)
            .to(F.him, { armLx: 0, armLz: 0, elbowLx: 0, duration: 0.4 }, 1.0)
            // her turn
            .to(props.herMomo.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2)' }, 1.7)
            .to(F.her, { puff: 0, x: -0.22, rotY: -0.6, armRx: -1.9, armRz: -0.5, elbowRx: -0.65, duration: 0.55, ease: 'power2.out' }, 1.8)
            .to(F.him, { pucker: 1, duration: 0.2 }, 2.15)
            .to(props.herMomo.scale, { x: 0, y: 0, z: 0, duration: 0.15 }, 2.5)
            .to(F.him, { pucker: 0, puff: 1, blush: 1, duration: 0.15 }, 2.5)
            .to(F.him, { puff: 0.4, duration: 0.14, yoyo: true, repeat: 5 }, 2.65)
          settle(t, F.him, 3.4)
          settle(t, F.her, 3.0)
        }),

      // 🙈 she tickles him; he laughs so hard he topples over, then pops back up
      tickle: () =>
        run((t) => {
          t.to(F.her, { x: -0.22, rotY: -0.55, armLx: -0.85, armRx: -0.85, armLz: -0.2, armRz: 0.2, happy: 1, mouthOpen: 0.6, duration: 0.45 })
            .to(F.her, { elbowLz: 0.4, elbowRz: -0.4, duration: 0.07, yoyo: true, repeat: 13, ease: 'sine.inOut' }, 0.45)
            .to(F.him, { happy: 1, laugh: 1, blush: 1, duration: 0.2 }, 0.5)
            .to(F.him, { lean: 0.12, bob: 0.07, duration: 0.09, yoyo: true, repeat: 9, ease: 'sine.inOut' }, 0.55)
            .to(F.him, { fall: 1, x: 0.12, duration: 0.45, ease: 'bounce.out' }, 1.5) // timber!
            .to(F.her, { x: 0.05, armLz: 1.2, armRz: -1.2, elbowLz: 0, elbowRz: 0, duration: 0.3 }, 1.6)
            .to(F.him, { fall: 0, x: 0, duration: 0.6, ease: 'back.out(1.6)' }, 2.6)
          settle(t, F.him, 3.2)
          settle(t, F.her, 2.9)
        }),

      idle: () =>
        run(
          (t) => {
            const pick = Math.floor(Math.random() * 5)
            if (pick === 0) {
              // he sneaks a glance at her; she notices and blushes
              t.to(F.him, { headZ: -0.2, rotY: 0.25, duration: 0.5 }).to(F.her, { blush: 1, happy: 1, duration: 0.3 }, 0.7)
            } else if (pick === 1) {
              // she leans on his shoulder for a moment
              t.to(F.her, { x: -0.1, headZ: 0.25, lean: 0.06, happy: 1, duration: 0.7 }).to(F.him, { blush: 0.6, duration: 0.4 }, 0.5)
            } else if (pick === 2) {
              // he pokes her cheek
              t.to(F.him, { x: 0.08, armLx: -0.75, armLz: 0.55, elbowLx: -0.55, duration: 0.45 }).to(F.her, { happy: 1, mouthOpen: 0.5, headZ: -0.1, duration: 0.25 }, 0.4)
            } else if (pick === 3) {
              // she yawns and stretches
              t.to(F.her, { armLz: 2.5, armRz: -2.5, mouthOpen: 1, happy: 1, duration: 0.6 })
            } else {
              // he waves at her (well — at you, holding the phone)
              t.to(F.him, { armRz: -2.5, elbowRz: -0.3, happy: 1, duration: 0.4 }).to(F.him, { elbowRz: -0.8, duration: 0.18, yoyo: true, repeat: 3 })
            }
            settle(t, F.him, '+=0.9', 0.6)
            settle(t, F.her, '<', 0.6)
          },
          (t) => (idleTl.current = t),
        ),

      stopIdle: () => {
        const t = idleTl.current
        if (!t || !t.isActive()) return
        t.progress(1) // jump to the end (settles everything to rest and resolves)
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [R, props],
  )

  const hc = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), p: new THREE.Vector3() }), [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const L = loveRef.current / 100
    // moods: more love → you stand closer; past ~60% you hold hands while idle; at 0 he looks a bit lonely
    mood.current.on = THREE.MathUtils.damp(mood.current.on, animating.current ? 0 : 1, 4, dt)
    const m = mood.current.on
    const spread = THREE.MathUtils.lerp(0.5, 0.4, L)
    const hold = THREE.MathUtils.smoothstep(L, 0.55, 0.7) * m
    const lonely = (1 - THREE.MathUtils.smoothstep(L, 0.0, 0.12)) * m
    const blushBase = L * 0.55

    for (const who of ['him', 'her'] as const) {
      const r = R[who]
      const f = F[who]
      const side = who === 'him' ? -1 : 1
      const rest = (o: THREE.Object3D) => r.rest.get(o)!
      const idle = Math.sin(t * 1.6 + (who === 'her' ? 1.3 : 0))
      r.root.position.set(side * spread - side * hold * 0.1 + f.x, f.y + Math.abs(f.bob * Math.sin(t * 9)) + 0.005 * idle + f.fall * 0.1, 0)
      r.root.rotation.set(-f.fall * 1.0, BASE_ROT[who] + f.rotY + f.spin, f.fall * 0.45) // tickle: flops onto his back
      r.torso.rotation.set(rest(r.torso).x + f.leanX, rest(r.torso).y, rest(r.torso).z + f.lean + 0.02 * idle)
      r.torso.scale.set(1, 1 + 0.01 * Math.sin(t * (f.sleep ? 1.2 : 2.2)), 1)
      const headDown = who === 'him' ? lonely * 0.14 : 0
      r.head.rotation.set(rest(r.head).x + f.headX + headDown, rest(r.head).y, rest(r.head).z + f.headZ + 0.03 * Math.sin(t * 0.9))
      r.head.scale.set(1 + f.puff * 0.07, 1, 1 + f.puff * 0.04)
      const flexL = f.flex * 1.45
      // idle hand-holding: his left (toward her) and her right (toward him)
      const holdZ = who === 'him' ? { L: 0.7 * hold, R: 0 } : { L: 0, R: -0.7 * hold }
      r.armL.rotation.set(rest(r.armL).x + f.armLx, rest(r.armL).y, rest(r.armL).z + f.armLz + flexL + holdZ.L)
      r.armR.rotation.set(rest(r.armR).x + f.armRx, rest(r.armR).y, rest(r.armR).z + f.armRz - flexL + holdZ.R)
      r.elbowL.rotation.set(rest(r.elbowL).x + f.elbowLx, rest(r.elbowL).y, rest(r.elbowL).z + f.elbowLz + f.flex * 1.85)
      r.elbowR.rotation.set(rest(r.elbowR).x + f.elbowRx, rest(r.elbowR).y, rest(r.elbowR).z + f.elbowRz - f.flex * 1.85)

      // blinking
      const bl = blink[who]
      if (bl.t < 0 && t > bl.next) bl.t = t
      let eyeY = 1
      if (bl.t >= 0) {
        const p = (t - bl.t) / 0.16
        eyeY = Math.abs(1 - 2 * Math.min(p, 1))
        if (p >= 1) {
          bl.t = -1
          bl.next = t + 2 + Math.random() * 3
        }
      }
      const blush = Math.max(f.blush, blushBase)
      if (who === 'her') {
        const happy = f.happy > 0.5
        r.eyes.forEach((e) => {
          e.visible = !happy
          e.scale.y = Math.max(0.08, eyeY)
        })
        r.parts('eyeHappy').forEach((e) => (e.visible = happy))
        r.parts('mouthSmile').forEach((mm) => (mm.visible = f.mouthOpen < 0.3))
        r.parts('mouthOpen').forEach((mm) => {
          mm.visible = f.mouthOpen >= 0.3
          mm.scale.setScalar(0.6 + f.mouthOpen * 0.5)
        })
        r.parts('blush').forEach((mm) => mm.scale.setScalar(1 + blush * 0.35))
      } else {
        // happy = squinty smile; sleep = eyes shut; pucker = little "o"; laugh = big open mouth
        r.eyes.forEach((e) => (e.scale.y = f.sleep > 0.5 ? 0.06 : Math.max(0.08, f.happy > 0.5 ? 0.3 : eyeY)))
        const open = f.pucker > 0.4 || f.laugh > 0.4
        r.parts('mouthSmirk').forEach((mm) => (mm.visible = !open))
        r.parts('mouthOuch').forEach((mm) => {
          mm.visible = open
          mm.scale.setScalar(f.laugh > 0.4 ? 0.85 : 0.45)
        })
        hisBlush.opacity = blush * 0.75
        r.parts('bicep').forEach((bc) => bc.scale.setScalar(1 + f.flex * 0.4))
      }
    }

    // keep the big heads from passing through each other (closer allowed during kisses/hugs)
    R.him.root.updateMatrixWorld(true)
    R.her.root.updateMatrixWorld(true)
    R.him.head.localToWorld(hc.a.copy(HEAD_CENTER))
    R.her.head.localToWorld(hc.b.copy(HEAD_CENTER))
    const gap = Math.hypot(hc.b.x - hc.a.x, hc.b.z - hc.a.z)
    const allowed = THREE.MathUtils.lerp(MIN_HEAD_GAP, CONTACT_GAP, Math.max(F.him.contact, F.her.contact))
    if (gap < allowed && !F.him.fall) {
      const push = (allowed - gap) / 2
      R.him.root.position.x -= push
      R.her.root.position.x += push
    }
    // …and keep the pair inside the frame (the screen is only ~2.3 units wide at their depth)
    const EDGE = 0.45
    const over = F.him.fall ? 0 : Math.max(0, -EDGE - R.him.root.position.x) - Math.max(0, R.her.root.position.x - EDGE)
    R.him.root.position.x += over
    R.her.root.position.x += over

    // slow dance: the couple turns around their shared centre
    if (env.orbit) {
      for (const r of [R.him, R.her]) {
        const { x, z } = r.root.position
        const c = Math.cos(env.orbit)
        const s = Math.sin(env.orbit)
        r.root.position.x = x * c + z * s
        r.root.position.z = -x * s + z * c
        r.root.rotation.y += env.orbit
      }
    }

    // flower flying from his hand into her hair
    if (env.flower > 0 && env.flower < 1) {
      R.her.head.localToWorld(hc.p.copy(HAIR_SPOT))
      props.inHand.position.lerpVectors(props.flowerFrom, hc.p, env.flower)
      props.inHand.position.y -= 0.12 * (1 - env.flower) // the full stem hangs below the blossom
    } else if (props.inHand.visible) {
      R.him.elbowL.localToWorld(props.inHand.position.set(0, -0.22, 0.06))
    }
    props.inHand.rotation.set(0, 0, 0)

    // momos sit right in front of the eater's lips, leaning slightly toward the feeder's fingers
    if (props.hisMomo.scale.x > 0.01) {
      R.him.elbowL.localToWorld(hc.p.set(0, -0.2, 0.05))
      R.her.head.localToWorld(props.hisMomo.position.set(0, 0.15, 0.52)) // just in front of her lips
      props.hisMomo.position.lerp(hc.p, 0.12)
    }
    if (props.herMomo.scale.x > 0.01) {
      R.her.elbowR.localToWorld(hc.p.set(0, -0.19, 0.05))
      R.him.head.localToWorld(props.herMomo.position.set(0, 0.16, 0.54))
      props.herMomo.position.lerp(hc.p, 0.12)
    }
  })

  // taps on the characters are a hidden bonus (the buttons are the main controls)
  const down = (who: Who) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    let o: THREE.Object3D | null = e.object
    let zone = 'body'
    while (o) {
      if (o.userData.zone) {
        zone = o.userData.zone
        break
      }
      o = o.parent
    }
    const start = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
    let done = false
    const touch: Touch = { who, zone, clientX: start.x, clientY: start.y }
    const longTimer = window.setTimeout(() => {
      done = true
      cleanup()
      onTouch(touch, 'long')
    }, 550)
    const move = (ev: PointerEvent) => {
      if (done) return
      const dx = ev.clientX - start.x
      if (Math.abs(dx) > 45) {
        done = true
        cleanup()
        onTouch({ ...touch, clientX: ev.clientX, clientY: ev.clientY }, 'swipe')
      } else if (Math.hypot(dx, ev.clientY - start.y) > 12) window.clearTimeout(longTimer)
    }
    const up = () => {
      if (done) return
      done = true
      cleanup()
      onTouch(touch, 'tap')
    }
    const cleanup = () => {
      window.clearTimeout(longTimer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <>
      <group onPointerDown={down('him')}>
        <primitive object={him} />
      </group>
      <group onPointerDown={down('her')}>
        <primitive object={her} />
      </group>
      <primitive object={props.inHand} />
      <primitive object={props.heart} />
      <primitive object={props.hisMomo} />
      <primitive object={props.herMomo} />
    </>
  )
}
