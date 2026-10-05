import { ContactShadows, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { Suspense, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import * as THREE from 'three'

const URL = '/models/me.glb'
useGLTF.preload(URL)
if (import.meta.env.DEV) (window as unknown as { gsap: typeof gsap }).gsap = gsap // lets devtools slow animations down

export type Zone = 'face' | 'head' | 'body' | 'legs' | 'arm'

/** Standing framing; the camera pulls back while he's lying down (he's wider than the screen). */
const CAM = { y: 1.15, z: 3.9, lookY: 1.0, koZ: 5.3, koLookY: 0.55 }

export interface Hit {
  zone: Zone
  /** -1 = hit on his left side of the screen, +1 = right. */
  side: number
  clientX: number
  clientY: number
}

export interface PunchApi {
  /** Flinch reaction; strength 0..1. */
  react: (hit: Hit, strength: number) => void
  /** Spin, fall flat, X eyes. Resolves once he's on the floor. */
  knockOut: (hit: Hit) => Promise<void>
  /** Get back up. Resolves when standing. */
  getUp: () => Promise<void>
  /** Double-bicep pose with pumping biceps. Resolves when he relaxes again. */
  flex: () => Promise<void>
  /** Begging from the floor while knocked out: waving arms, "no no" head shake. */
  plead: () => void
  /** Wink, hand to lips, blow a kiss. `onBlow` fires the moment the kiss leaves his hand. */
  kiss: (onBlow: () => void) => Promise<void>
}

type FaceMode = 'normal' | 'ouch' | 'ko' | 'sad' | 'kiss'

interface Rig {
  root: THREE.Object3D
  torso: THREE.Object3D
  head: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  elbowL: THREE.Object3D
  elbowR: THREE.Object3D
  biceps: THREE.Object3D[]
  eyes: THREE.Object3D[]
  eyeX: THREE.Object3D[]
  smirk: THREE.Object3D[]
  ouch: THREE.Object3D[]
  rest: Record<'torso' | 'head' | 'armL' | 'armR' | 'elbowL' | 'elbowR', THREE.Euler>
}

/** Windowpane check on the blazer, drawn in the shader from local position (the model has no UVs). */
function addBlazerCheck(m: THREE.MeshStandardMaterial) {
  if (m.userData.check) return
  m.userData.check = true
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 cell = vec2((vLocal.x + vLocal.z) * 10.0, vLocal.y * 10.0);
        vec2 d = abs(fract(cell) - 0.5);
        vec2 aa = fwidth(cell) * 1.2;
        float line = max(smoothstep(0.47 - aa.x, 0.47, d.x), smoothstep(0.47 - aa.y, 0.47, d.y));
        diffuseColor.rgb *= 1.0 - 0.3 * line;`,
      )
  }
}

function buildRig(scene: THREE.Object3D): Rig {
  const byPart = (p: string) => {
    const out: THREE.Object3D[] = []
    scene.traverse((o) => o.userData.part === p && out.push(o))
    return out
  }
  const one = (p: string) => byPart(p)[0]
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat.name === 'Blazer') addBlazerCheck(mat)
    if (mat.name === 'Hair') mat.roughness = 0.5
    if (mat.name === 'Eye' || mat.name === 'EyeShine') mat.roughness = 0.1
  })
  // the KO "X" bars were exported with an offset — centre them on their eye
  const eyeX = byPart('eyeX').filter((o) => !(o as THREE.Mesh).isMesh)
  eyeX.forEach((g) => g.children.forEach((c) => c.position.set(0, 0, 0)))
  eyeX.forEach((g) => (g.visible = false))
  const ouch = byPart('mouthOuch')
  ouch.forEach((o) => (o.visible = false))
  const rig: Rig = {
    root: one('root'),
    torso: one('torso'),
    head: one('head'),
    armL: one('armL'),
    armR: one('armR'),
    elbowL: one('elbowL'),
    elbowR: one('elbowR'),
    biceps: byPart('bicep'),
    eyes: byPart('eye'),
    eyeX,
    smirk: byPart('mouthSmirk'),
    ouch,
    rest: {} as Rig['rest'],
  }
  for (const k of ['torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR'] as const) rig.rest[k] = rig[k].rotation.clone()
  return rig
}

function zoneOf(o: THREE.Object3D | null): Zone {
  while (o) {
    const z = o.userData.zone as Zone | undefined
    if (z) return z
    o = o.parent
  }
  return 'body'
}

export default function PunchScene(props: { apiRef: Ref<PunchApi>; active: boolean; damage: number; onHit: (hit: Hit) => void }) {
  return (
    <Canvas frameloop={props.active ? 'always' : 'never'} dpr={[1, 2]} camera={{ position: [0, CAM.y, CAM.z], fov: 40 }} gl={{ antialias: true }} onCreated={({ camera }) => camera.lookAt(0, CAM.lookY, 0)}>
      <color attach="background" args={['#1b1230']} />
      <hemisphereLight args={['#fff1f6', '#3a2a52', 1.1]} />
      <directionalLight position={[1.5, 3, 3]} intensity={1.8} color="#fff6ee" />
      <directionalLight position={[-2.5, 1.5, -1]} intensity={0.9} color="#b9a7ff" />
      <Stage />
      <Suspense fallback={null}>
        <Me {...props} />
      </Suspense>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={3} blur={2.4} far={2} />
    </Canvas>
  )
}

/** A soft spotlit floor so he isn't floating in the void. */
function Stage() {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[1.6, 48]} />
      <meshStandardMaterial color="#2c1f45" roughness={0.95} />
    </mesh>
  )
}

function Me({ apiRef, damage, onHit }: { apiRef: Ref<PunchApi>; damage: number; onHit: (hit: Hit) => void }) {
  const { scene } = useGLTF(URL)
  const rig = useMemo(() => buildRig(scene), [scene])
  // reaction offsets, animated by GSAP and added on top of the idle motion every frame
  const fx = useRef({ headX: 0, headZ: 0, torsoX: 0, torsoZ: 0, armL: 0, armR: 0, squash: 0, fall: 0, fallSide: 1, spin: 0, ko: false, ouch: 0, flex: 0, pump: 0, kiss: 0, blow: 0, wink: 0 })
  const stars = useRef<THREE.Group>(null)
  const blink = useRef({ next: 2, t: -1 })
  const headPos = useMemo(() => new THREE.Vector3(), [])
  const dmg = useRef(damage)
  dmg.current = damage
  const camera = useThree((s) => s.camera)

  const setFace = (mode: FaceMode) => {
    const ko = mode === 'ko'
    const mouthOpen = mode !== 'normal'
    rig.eyes.forEach((o) => (o.visible = !ko))
    rig.eyeX.forEach((o) => (o.visible = ko))
    rig.smirk.forEach((o) => (o.visible = !mouthOpen))
    rig.ouch.forEach((o) => (o.visible = mouthOpen))
    // a small round "o" when sad, a tight pucker for the kiss
    const m = mode === 'kiss' ? 0.45 : mode === 'sad' ? 0.7 : 1
    rig.ouch.forEach((o) => o.scale.setScalar(m))
  }

  useImperativeHandle(
    apiRef,
    () => ({
      react(hit, strength) {
        const f = fx.current
        const s = 0.5 + strength
        const tl = gsap.timeline()
        const snap = (target: object, vars: gsap.TweenVars) => tl.to(target, { ...vars, duration: 0.08, ease: 'power2.out' }, 0)
        const settle = (target: object, keys: string[]) =>
          tl.to(target, { ...Object.fromEntries(keys.map((k) => [k, 0])), duration: 0.9 + strength * 0.5, ease: 'elastic.out(1, 0.3)' }, 0.09)
        if (hit.zone === 'face' || hit.zone === 'head') {
          snap(f, { headX: -0.45 * s, headZ: -hit.side * 0.45 * s, torsoX: -0.12 * s, squash: 0.18 * s, armL: 0.5 * s, armR: 0.5 * s })
          settle(f, ['headX', 'headZ', 'torsoX', 'squash', 'armL', 'armR'])
        } else {
          // body blow: folds forward a little
          snap(f, { torsoX: 0.28 * s, torsoZ: -hit.side * 0.15 * s, headX: 0.25 * s, armL: 0.3 * s, armR: 0.3 * s })
          settle(f, ['torsoX', 'torsoZ', 'headX', 'armL', 'armR'])
        }
        f.ouch = performance.now() + 450
        setFace('ouch')
        gsap.delayedCall(0.45, () => !f.ko && setFace('normal'))
      },

      knockOut(hit) {
        const f = fx.current
        f.ko = true
        f.fallSide = hit.side >= 0 ? -1 : 1 // topple away from the punch
        setFace('ko')
        return new Promise<void>((resolve) => {
          gsap
            .timeline({ onComplete: resolve })
            .to(f, { headX: -0.6, headZ: -hit.side * 0.6, armL: 1.6, armR: 1.6, squash: 0.25, duration: 0.1, ease: 'power2.out' })
            .to(f, { spin: Math.PI * 2 * -hit.side, duration: 0.55, ease: 'power1.in' }, 0.05)
            .to(f, { fall: 1, duration: 0.5, ease: 'bounce.out' }, 0.45)
            .to(f, { squash: 0, headZ: 0, headX: -0.2, duration: 0.4 }, 0.5)
            .to(f, { armL: 2.4, armR: 2.4, duration: 0.5, ease: 'back.out(2)' }, 0.55)
            // …then he comes round on the floor with sad puppy eyes
            .call(() => f.ko && setFace('sad'), [], 1.6)
        })
      },

      plead() {
        const f = fx.current
        setFace('sad')
        gsap
          .timeline()
          .to(f, { armL: 1.2, armR: 1.2, duration: 0.16, yoyo: true, repeat: 5, ease: 'sine.inOut' })
          .to(f, { headZ: 0.28, duration: 0.11, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0)
          .to(f, { armL: 2.4, armR: 2.4, headZ: 0, duration: 0.3 })
      },

      kiss(onBlow) {
        const f = fx.current
        return new Promise<void>((resolve) => {
          gsap
            .timeline({ onComplete: () => (setFace('normal'), resolve()) })
            .call(() => setFace('kiss'))
            .to(f, { kiss: 1, wink: 1, duration: 0.45, ease: 'power2.out' })         // hand to lips, wink
            .to(f, { headZ: -0.1, duration: 0.3 }, 0)
            .to(f, { blow: 1, duration: 0.22, ease: 'power3.out' }, 0.85)             // …mwah!
            .call(onBlow, [], 0.9)
            .to(f, { kiss: 0, blow: 0, wink: 0, headZ: 0, duration: 0.55, ease: 'power2.inOut' }, 1.7)
        })
      },

      flex() {
        const f = fx.current
        return new Promise<void>((resolve) => {
          gsap
            .timeline({ onComplete: resolve })
            .to(f, { flex: 1, duration: 0.45, ease: 'back.out(1.8)' })
            .to(f, { headZ: 0.14, headX: 0.06, duration: 0.3, ease: 'power2.out' }, 0.1) // smug little tilt
            .to(f, { pump: 1, duration: 0.18, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.5)
            .call(() => navigator.vibrate?.([10, 60, 10, 60, 10]), [], 0.5)
            .to(f, { flex: 0, headZ: 0, headX: 0, pump: 0, duration: 0.6, ease: 'power2.inOut' }, 2.0)
        })
      },

      getUp() {
        const f = fx.current
        return new Promise<void>((resolve) => {
          gsap
            .timeline({
              onComplete: () => {
                f.ko = false
                f.spin = 0
                setFace('normal')
                resolve()
              },
            })
            .to(f, { fall: 0, duration: 0.7, ease: 'back.out(1.6)' })
            .to(f, { armL: 0, armR: 0, headX: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0.4)
            .call(() => setFace('normal'), [], 0.5)
            // little shake of the head ("phew")
            .to(f, { headZ: 0.25, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.8)
            .set(f, { headZ: 0 })
        })
      },
    }),
    [rig],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = fx.current
    const d = dmg.current / 100
    // dizziness grows with damage: lazy circles of the head and a wobbly body
    const dizzy = f.ko ? 0 : Math.max(0, d - 0.35) / 0.65
    const breathe = Math.sin(t * 2.2) * 0.012
    rig.torso.rotation.x = rig.rest.torso.x + f.torsoX + Math.sin(t * 1.3) * 0.04 * dizzy
    rig.torso.rotation.z = rig.rest.torso.z + f.torsoZ + Math.sin(t * 0.9) * 0.08 * dizzy + Math.sin(t * 0.7) * 0.015
    rig.torso.scale.set(1, 1 + breathe, 1)
    rig.head.rotation.x = rig.rest.head.x + f.headX + Math.sin(t * 2.6) * 0.12 * dizzy
    rig.head.rotation.z = rig.rest.head.z + f.headZ + Math.cos(t * 2.6) * 0.15 * dizzy + Math.sin(t * 0.8) * 0.03
    rig.head.scale.set(1 + f.squash * 0.6, 1 - f.squash, 1 + f.squash * 0.6)
    // arms: flinch + dizzy wobble + the flex pose (upper arms out to the side, forearms up)
    rig.armL.rotation.z = rig.rest.armL.z + f.armL + f.flex * 1.45 + Math.sin(t * 3.1) * 0.12 * dizzy
    rig.armR.rotation.z = rig.rest.armR.z - f.armR - f.flex * 1.45 - Math.sin(t * 2.9) * 0.12 * dizzy
    rig.elbowL.rotation.z = rig.rest.elbowL.z + f.flex * 1.85
    rig.elbowR.rotation.z = rig.rest.elbowR.z - f.flex * 1.85
    // flying kiss (right arm): swing forward + bend the hand up to the lips, then straighten toward her
    rig.armR.rotation.x = rig.rest.armR.x - f.kiss * 1.15 - f.blow * 0.45
    rig.elbowR.rotation.x = rig.rest.elbowR.x - f.kiss * 2.1 * (1 - f.blow * 0.85)
    const bulge = 1 + f.flex * 0.4 + f.pump * 0.18
    rig.biceps.forEach((b) => b.scale.set(bulge, bulge, 1 + (bulge - 1) * 0.5))
    // knockout: spin on the spot, then topple sideways onto the floor, face still toward her,
    // sliding over so he lands centred (he's ~1.7 units tall) and resting on his big head
    rig.root.rotation.set(0, f.spin, -f.fall * 1.5 * f.fallSide)
    rig.root.position.set(-f.fallSide * 0.8 * f.fall, 0.28 * f.fall, 0)
    camera.position.z = THREE.MathUtils.lerp(CAM.z, CAM.koZ, f.fall)
    camera.lookAt(0, THREE.MathUtils.lerp(CAM.lookY, CAM.koLookY, f.fall), 0)

    // blinking (not while knocked out or flinching)
    const b = blink.current
    if (b.t < 0 && t > b.next) b.t = t
    let eyeY = 1
    if (b.t >= 0) {
      const p = (t - b.t) / 0.16
      eyeY = Math.abs(1 - 2 * Math.min(p, 1))
      if (p >= 1) {
        b.t = -1
        b.next = t + 2 + Math.random() * 3.5
      }
    }
    if (performance.now() < f.ouch) eyeY = 0.25 // squeezed shut while it stings
    rig.eyes.forEach((e) => (e.scale.y = Math.max(0.08, e.name.endsWith('L') ? Math.min(eyeY, 1 - f.wink * 0.92) : eyeY)))

    // cartoon stars circle his head when he's dizzy or KO
    if (stars.current) {
      const show = f.ko || d >= 0.6
      stars.current.visible = show
      if (show) {
        rig.head.getWorldPosition(headPos)
        stars.current.position.copy(headPos).add(new THREE.Vector3(0, 0.95, 0).applyQuaternion(rig.root.quaternion))
        stars.current.rotation.y = t * 3
      }
    }
  })

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const local = e.point.clone()
    onHit({ zone: zoneOf(e.object), side: local.x >= 0 ? 1 : -1, clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY })
  }

  return (
    <>
      <group onPointerDown={handleDown}>
        <primitive object={scene} />
      </group>
      <group ref={stars} visible={false}>
        {[0, 1, 2].map((i) => (
          <Star key={i} angle={(i / 3) * Math.PI * 2} />
        ))}
      </group>
    </>
  )
}

const starShape = (() => {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.022 : 0.055
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return s
})()

function Star({ angle }: { angle: number }) {
  return (
    <mesh position={[Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38]}>
      <shapeGeometry args={[starShape]} />
      <meshBasicMaterial color="#ffd84d" side={THREE.DoubleSide} />
    </mesh>
  )
}
