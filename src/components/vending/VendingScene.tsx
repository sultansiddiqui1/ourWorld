import { Environment, Lightformer, Sparkles, useGLTF } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import * as THREE from 'three'

const URL = '/models/vending.glb'
useGLTF.preload(URL)
if (import.meta.env.DEV) (window as unknown as { gsap: typeof gsap }).gsap = gsap // lets devtools slow animations down

const CAPSULE_COLORS = ['#ff7aa2', '#ffb347', '#8fd3ff', '#b79cff', '#7fe0b0', '#ffd84d', '#ff9a8a']
const LOOK_AT = new THREE.Vector3(-0.04, 1.0, 0)
/** The reveal spot: halfway along the camera's line of sight, a little above centre (above the card). */
const revealPoint = (camera: THREE.Camera) => camera.position.clone().lerp(LOOK_AT, 0.5).add(new THREE.Vector3(0, 0.2, 0))

export interface VendingApi {
  /** Runs the whole dispense animation; resolves when the capsule has popped open. */
  dispense: (golden: boolean) => Promise<void>
  /** Clears the opened capsule and restocks its slot. */
  reset: () => void
  /** Pulls the side lever all the way down (from wherever it is) and lets it spring back up. */
  press: () => void
}

interface Slot {
  node: THREE.Object3D
  coil: THREE.Object3D
  /** [front, back] */
  caps: THREE.Object3D[]
}

const mat = {
  body: new THREE.MeshStandardMaterial({ color: '#f59bbb', roughness: 0.42, metalness: 0.05 }),
  trim: new THREE.MeshStandardMaterial({ color: '#fff1f6', roughness: 0.35 }),
  panel: new THREE.MeshStandardMaterial({ color: '#ffe3ec', roughness: 0.45 }),
  interior: new THREE.MeshStandardMaterial({ color: '#2a1838', roughness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ color: '#d8dbe8', roughness: 0.22, metalness: 1 }),
  shelf: new THREE.MeshStandardMaterial({ color: '#efe6f6', roughness: 0.35, metalness: 0.25 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false }),
  flap: new THREE.MeshPhysicalMaterial({ color: '#c9d8ff', roughness: 0.1, transparent: true, opacity: 0.4, clearcoat: 1 }),
  tray: new THREE.MeshStandardMaterial({ color: '#1a1022', roughness: 0.9 }),
  screen: new THREE.MeshStandardMaterial({ color: '#0d2a2c', emissive: '#4ff0d8', emissiveIntensity: 0.55, roughness: 0.2 }),
  button: new THREE.MeshStandardMaterial({ color: '#e8285a', emissive: '#ff2f6d', emissiveIntensity: 0.35, roughness: 0.3 }),
  key: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
  slot: new THREE.MeshStandardMaterial({ color: '#241626', roughness: 0.6 }),
  sign: new THREE.MeshStandardMaterial({ color: '#3a1a46', roughness: 0.4 }),
  signText: new THREE.MeshStandardMaterial({ color: '#ffe3f0', emissive: '#ff8fbf', emissiveIntensity: 1.6 }),
  knob: new THREE.MeshPhysicalMaterial({ color: '#ff3d74', roughness: 0.15, clearcoat: 1, emissive: '#ff2f6d', emissiveIntensity: 0.15 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff4e6', emissive: '#fff0dc', emissiveIntensity: 2.2 }),
  feet: new THREE.MeshStandardMaterial({ color: '#2b2030', roughness: 0.6 }),
  capBottom: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1 }),
  gold: new THREE.MeshPhysicalMaterial({ color: '#ffd24a', metalness: 0.55, roughness: 0.25, clearcoat: 1, emissive: '#c98a00', emissiveIntensity: 0.55 }),
}
const BY_NAME: Record<string, THREE.Material> = {
  Body: mat.body, Trim: mat.trim, Panel: mat.panel, Interior: mat.interior, Shelf: mat.shelf, Coil: mat.metal,
  Glass: mat.glass, Flap: mat.flap, Tray: mat.tray, Screen: mat.screen, Button: mat.button, Key: mat.key,
  Slot: mat.slot, Knob: mat.knob, Sign: mat.sign, SignText: mat.signText, Lamp: mat.lamp, Feet: mat.feet, CapBottom: mat.capBottom,
}
const capColorMats = CAPSULE_COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }))

const isButton = (o: THREE.Object3D) => o.userData.part === 'button' || o.name === 'ButtonRing'
const isLever = (o: THREE.Object3D | null): boolean => !!o && (o.userData.part === 'lever' || isLever(o.parent))
/** Lever travel: 0 = up (rest), LEVER_DOWN = pulled all the way down and forward. */
const LEVER_DOWN = 2.25
/** Finger travel (px) for a full pull, and how far it must go to count. */
const PULL_PX = 160
const PULL_THRESHOLD = 0.6

function prepare(scene: THREE.Object3D) {
  if (scene.userData.prepared) return
  scene.userData.prepared = true
  let n = 0
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const name = (m.material as THREE.Material).name
    if (m.userData.part === 'capTop') m.material = capColorMats[n++ % capColorMats.length]
    else if (m.name.startsWith('ShelfLip')) m.material = mat.shelf
    else if (BY_NAME[name]) m.material = BY_NAME[name]
    m.castShadow = m.receiveShadow = false
  })
}

export default function VendingScene({ apiRef, active, onButton }: { apiRef: Ref<VendingApi>; active: boolean; onButton: () => void }) {
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={[1, 2]} camera={{ position: [0.85, 1.5, 4.6], fov: 36 }} gl={{ antialias: true }}>
      <color attach="background" args={['#120d22']} />
      <fog attach="fog" args={['#120d22', 6, 12]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} color="#fff2f6" />
      <pointLight position={[-0.15, 1.3, 0.1]} intensity={1.2} distance={1.4} color="#ffe9d6" />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 3, 2]} scale={[5, 2, 1]} color="#ffe6f0" />
        <Lightformer form="rect" intensity={1.2} position={[-3, 1, 1]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} color="#b7a6ff" />
        <Lightformer form="rect" intensity={0.8} position={[3, 1, 1]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} color="#ffc7a8" />
      </Environment>
      <Floor />
      <Suspense fallback={null}>
        <Machine apiRef={apiRef} onButton={onButton} />
      </Suspense>
    </Canvas>
  )
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
      <circleGeometry args={[2.2, 48]} />
      <meshStandardMaterial color="#21173a" roughness={0.9} />
    </mesh>
  )
}

function Machine({ apiRef, onButton }: { apiRef: Ref<VendingApi>; onButton: () => void }) {
  const { scene } = useGLTF(URL)
  prepare(scene)
  const camera = useThree((s) => s.camera)
  const [burst, setBurst] = useState<{ golden: boolean; at: THREE.Vector3 } | null>(null)

  const parts = useMemo(() => {
    const find = (part: string) => {
      let hit: THREE.Object3D | undefined
      scene.traverse((o) => {
        if (!hit && o.userData.part === part) hit = o
      })
      return hit!
    }
    const slots: Slot[] = []
    scene.traverse((o) => {
      if (o.userData.part !== 'slot') return
      const caps = o.children.filter((c) => c.userData.part === 'capsule').sort((a, b) => a.userData.depth - b.userData.depth)
      slots.push({ node: o, coil: o.children.find((c) => c.userData.part === 'coil')!, caps })
    })
    const front = slots[0].caps[0].position.z
    const back = slots[0].caps[1].position.z
    return { root: scene, slots, button: find('button'), lever: find('lever'), flap: find('flapPivot'), screen: find('screen'), front, back, capY: slots[0].caps[0].position.y }
  }, [scene])

  useEffect(() => {
    camera.lookAt(LOOK_AT)
  }, [camera])

  // what's currently out of the machine
  const out = useRef<{ cap: THREE.Object3D; slot: Slot; topMat: THREE.Material } | null>(null)

  useImperativeHandle(
    apiRef,
    () => ({
      press() {
        gsap.fromTo(parts.button.position, { z: parts.button.userData.z0 ?? (parts.button.userData.z0 = parts.button.position.z) }, {
          z: (parts.button.userData.z0 as number) - 0.014,
          duration: 0.08,
          yoyo: true,
          repeat: 1,
        })
        gsap.fromTo(mat.button, { emissiveIntensity: 1.4 }, { emissiveIntensity: 0.35, duration: 0.6 })
        // the lever: yank down (continuing from a finger-drag if there was one), clunk, spring back up
        gsap
          .timeline()
          .to(parts.lever.rotation, { x: LEVER_DOWN, duration: 0.28 * (1 - parts.lever.rotation.x / LEVER_DOWN) + 0.06, ease: 'power2.in', overwrite: true })
          .call(() => navigator.vibrate?.(12))
          .to(parts.lever.rotation, { x: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' }, '+=0.12')
        gsap.fromTo(mat.knob, { emissiveIntensity: 0.9 }, { emissiveIntensity: 0.15, duration: 0.8 })
      },

      dispense(golden) {
        return new Promise<void>((resolve) => {
          const { slots, front, flap, root } = parts
          const slot = slots[Math.floor(Math.random() * slots.length)]
          const [cap, next] = slot.caps
          const top = cap.children.find((c) => c.userData.part === 'capTop') as THREE.Mesh
          const topMat = top.material as THREE.Material
          out.current = { cap, slot, topMat }

          // world → slot-local helper (slots are only translated)
          const local = (w: THREE.Vector3) => w.clone().sub(slot.node.getWorldPosition(new THREE.Vector3()))
          const lane = front + 0.13
          const trayY = local(new THREE.Vector3(0, 0.2, 0)).y
          const trayOut = local(new THREE.Vector3(-0.125, 0.27, 0.7))
          const revealWorld = revealPoint(camera)
          const reveal = local(revealWorld)

          const tl = gsap.timeline({ onComplete: resolve })
          // screen flickers "processing"
          tl.to(mat.screen, { emissiveIntensity: 1.3, duration: 0.12, yoyo: true, repeat: 3 }, 0)
          // 1. the coil turns once, pushing the front capsule off the shelf edge
          tl.to(slot.coil.rotation, { z: `-=${Math.PI * 2}`, duration: 1.4, ease: 'power1.inOut' }, 0.2)
          tl.to(cap.position, { z: lane, duration: 1.4, ease: 'power1.inOut' }, 0.2)
          tl.to(next.position, { z: front, duration: 1.4, ease: 'power1.inOut' }, 0.2)
          tl.to(cap.rotation, { x: 0.5, duration: 0.25, ease: 'power1.in' }, 1.4)
          // 2. it drops behind the panel…
          tl.to(cap.position, { y: trayY, duration: 0.42, ease: 'power2.in' }, 1.55)
          tl.to(cap.rotation, { x: 4, z: 1.2, duration: 0.42, ease: 'none' }, 1.55)
          // …thunk: the machine jolts
          tl.call(() => navigator.vibrate?.(25), [], 1.97)
          tl.to(root.position, { y: -0.012, duration: 0.06, yoyo: true, repeat: 1, ease: 'power1.out' }, 1.97)
          tl.to(root.rotation, { z: 0.006, duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.97)
          // 3. the flap swings open and the capsule rolls out toward her
          tl.to(flap.rotation, { x: -1.15, duration: 0.45, ease: 'back.out(1.6)' }, 2.25)
          tl.to(cap.position, { x: trayOut.x, y: trayOut.y, z: trayOut.z, duration: 0.55, ease: 'power2.out' }, 2.4)
          tl.to(cap.rotation, { x: 0, z: 0, duration: 0.55 }, 2.4)
          // 4. it floats up to the reveal spot, growing…
          if (golden) tl.call(() => void (top.material = mat.gold), [], 2.9)
          tl.to(cap.position, { x: reveal.x, y: reveal.y, z: reveal.z, duration: 0.9, ease: 'power3.inOut' }, 2.95)
          tl.to(cap.scale, { x: 2.1, y: 2.1, z: 2.1, duration: 0.9, ease: 'power3.inOut' }, 2.95)
          tl.to(cap.rotation, { y: Math.PI * 2, duration: 1.3, ease: 'power2.out' }, 2.95)
          tl.to(flap.rotation, { x: 0, duration: 0.5, ease: 'power2.in' }, 3.2)
          // 5. …wobbles, and pops open
          tl.to(cap.rotation, { z: 0.18, duration: 0.07, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 4.0)
          tl.call(() => setBurst({ golden, at: revealWorld }), [], 4.45)
          tl.to(top.position, { y: 0.05, x: -0.02, duration: 0.35, ease: 'back.out(3)' }, 4.45)
          tl.to(top.rotation, { z: 0.65, duration: 0.35, ease: 'power2.out' }, 4.45)
          tl.set({}, {}, 4.75)
          // the second capsule is now at the front; this one restocks at the back on reset()
          tl.call(() => void (slot.caps = [next, cap]), [], 1.6)
        })
      },

      reset() {
        const o = out.current
        if (!o) return
        out.current = null
        setBurst(null)
        const { cap, topMat } = o
        const top = cap.children.find((c) => c.userData.part === 'capTop') as THREE.Mesh
        gsap.to(cap.scale, {
          x: 0.001,
          y: 0.001,
          z: 0.001,
          duration: 0.3,
          ease: 'back.in(2)',
          onComplete: () => {
            // put it back at the end of the coil and let it grow back in
            top.material = topMat === mat.gold ? capColorMats[Math.floor(Math.random() * capColorMats.length)] : topMat
            top.position.set(0, 0, 0)
            top.rotation.set(0, 0, 0)
            cap.rotation.set(0, 0, 0)
            cap.position.set(0, parts.capY, parts.back)
            gsap.to(cap.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(2)', delay: 0.2 })
          },
        })
      },
    }),
    [parts, camera],
  )

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isButton(e.object) && !(isLever(e.object) && e.delta < 6)) return // a tap on the lever pulls it too
    e.stopPropagation()
    onButton()
  }

  // Drag the lever down with a finger; past the threshold it fires, otherwise it springs back.
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isLever(e.object)) return
    e.stopPropagation()
    const lever = parts.lever
    gsap.killTweensOf(lever.rotation)
    const startY = e.nativeEvent.clientY
    const start = lever.rotation.x
    let moved = false
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (Math.abs(dy) > 6) moved = true
      lever.rotation.x = THREE.MathUtils.clamp(start + (dy / PULL_PX) * LEVER_DOWN, 0, LEVER_DOWN)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moved) return // treated as a tap by handleClick
      if (lever.rotation.x >= LEVER_DOWN * PULL_THRESHOLD) onButton()
      // if the machine was busy (or the pull was too short) nobody animated the lever: spring it back
      if (!gsap.isTweening(lever.rotation)) gsap.to(lever.rotation, { x: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (isButton(e.object) || isLever(e.object)) document.body.style.cursor = isLever(e.object) ? 'grab' : 'pointer'
  }

  return (
    <>
      <group onClick={handleClick} onPointerDown={handlePointerDown} onPointerOver={handleOver} onPointerOut={() => (document.body.style.cursor = '')}>
        <primitive object={scene} />
      </group>
      {burst && (
        <Sparkles
          key={burst.golden ? 'g' : 'n'}
          position={burst.at}
          count={burst.golden ? 60 : 28}
          scale={burst.golden ? 1.1 : 0.7}
          size={burst.golden ? 7 : 4}
          speed={0.8}
          color={burst.golden ? '#ffd76a' : '#ffc2dc'}
        />
      )}
    </>
  )
}
