import { Line, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

const PLANE = '/models/plane.glb'
const ME = '/models/me.glb'
const HER = '/models/her.glb'
const FLOWERS = '/models/flowers.glb'
useGLTF.preload(PLANE)

/** The route: from his island (left) up over the clouds and down to hers (right). */
const START = new THREE.Vector3(-0.82, 0.35, 0)
const CTRL = new THREE.Vector3(-0.15, 2.5, 0.3)
const END = new THREE.Vector3(0.38, 0.45, 0.15)
const HER_X = 0.78
const ROUTE = new THREE.QuadraticBezierCurve3(START, CTRL, END)

interface Props {
  progress: number
  arrived: boolean
  labels: { her: HTMLElement | null; him: HTMLElement | null }
  active: boolean
}

export default function CountdownScene(props: Props) {
  return (
    <Canvas frameloop={props.active ? 'always' : 'never'} dpr={[1, 2]} camera={{ position: [0, 1.25, 6.4], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 1.0, 0)}>
      <Sky />
      <hemisphereLight args={['#ffffff', '#ffc2d6', 1.3]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} color="#fff6ee" />
      <Clouds />
      <Islands labels={props.labels} />
      <Suspense fallback={null}>
        <Her arrived={props.arrived} />
        <Journey progress={props.progress} arrived={props.arrived} />
      </Suspense>
    </Canvas>
  )
}

/** Soft pastel sky gradient behind everything. */
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color('#9cc8ff') }, bottom: { value: new THREE.Color('#ffd9e6') } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.15, 0.95, vUv.y)), 1.0); }',
      }),
    [],
  )
  return (
    <mesh position={[0, 1, -8]} material={mat}>
      <planeGeometry args={[30, 20]} />
    </mesh>
  )
}

/** Puffy clouds drifting slowly across. */
function Clouds() {
  const group = useRef<THREE.Group>(null)
  const clouds = useMemo(
    () =>
      [
        [-2.4, 2.6, -2.5, 1.0],
        [1.8, 3.1, -3.5, 1.3],
        [0.2, 0.0, -1.8, 0.8],
        [-1.4, 1.2, -4.0, 1.5],
        [2.6, 0.9, -2.2, 0.9],
      ].map(([x, y, z, s], i) => ({ x, y, z, s, speed: 0.04 + i * 0.012 })),
    [],
  )
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }), [])
  const geo = useMemo(() => new THREE.SphereGeometry(0.35, 16, 12), [])
  useFrame((_, dt) => {
    group.current?.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt
      if (c.position.x > 4) c.position.x = -4
    })
  })
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[
            [0, 0, 0, 1],
            [0.32, 0.05, 0, 0.8],
            [-0.32, 0.02, 0, 0.75],
            [0.12, 0.22, 0, 0.75],
          ].map(([x, y, z, s], k) => (
            <mesh key={k} geometry={geo} material={mat} position={[x, y, z]} scale={[s * 1.2, s, s]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Two little floating islands — yours on the left, hers on the right — with labels pinned above. */
function Islands({ labels }: { labels: Props['labels'] }) {
  const grass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7fd18b', roughness: 0.9, flatShading: true }), [])
  const rock = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b98a6a', roughness: 1, flatShading: true }), [])
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const pin = (el: HTMLElement | null, x: number, y: number) => {
      if (!el) return
      v.set(x, y, 0).project(camera)
      el.style.transform = `translate(-50%, 0) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
    pin(labels.him, START.x, START.y - 0.45)
    pin(labels.her, HER_X, -0.28)
  })
  const island = (x: number, y: number, s: number) => (
    <group position={[x, y, 0]} scale={s}>
      <mesh material={grass} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.5, 0.12, 9]} />
      </mesh>
      <mesh material={rock} position={[0, -0.32, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.5, 0.55, 9]} />
      </mesh>
    </group>
  )
  return (
    <>
      {island(START.x, START.y - 0.22, 0.7)}
      {island(HER_X, 0.08, 0.95)}
    </>
  )
}

function useRig(scene: THREE.Object3D) {
  return useMemo(() => {
    const parts = new Map<string, THREE.Object3D[]>()
    scene.traverse((o) => {
      const p = o.userData.part as string | undefined
      if (p) parts.set(p, [...(parts.get(p) ?? []), o])
    })
    const get = (p: string) => parts.get(p) ?? []
    const rest = new Map<THREE.Object3D, THREE.Euler>()
    for (const p of ['armL', 'armR', 'elbowL', 'elbowR', 'head', 'torso']) for (const o of get(p)) rest.set(o, o.rotation.clone())
    return { get, rest }
  }, [scene])
}

/** Her, waiting on her island with open arms (and a little hop of excitement). */
function Her({ arrived }: { arrived: boolean }) {
  const { scene } = useGLTF(HER)
  const her = useMemo(() => scene.clone(true), [scene])
  const rig = useRig(her)
  useMemo(() => {
    rig.get('eyeHappy').forEach((o) => (o.visible = true))
    rig.get('eye').forEach((o) => (o.visible = false))
    rig.get('mouthOpen').forEach((o) => (o.visible = false))
  }, [rig])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const [armL] = rig.get('armL')
    const [armR] = rig.get('armR')
    const [head] = rig.get('head')
    const open = 1.15 + Math.sin(t * 2.2) * 0.12 // arms wide, swaying "come here!"
    armL.rotation.z = rig.rest.get(armL)!.z + open
    armR.rotation.z = rig.rest.get(armR)!.z - open
    head.rotation.z = rig.rest.get(head)!.z + Math.sin(t * 1.4) * 0.08
    her.position.y = 0.14 + Math.abs(Math.sin(t * (arrived ? 6 : 2.2))) * (arrived ? 0.12 : 0.03)
  })
  return <primitive object={her} position={[HER_X, 0.14, 0]} rotation-y={-0.45} scale={0.5} />
}

/** The plane, carrying him (waving, flower in hand) along the route; dotted path + heart trail + banner. */
function Journey({ progress, arrived }: { progress: number; arrived: boolean }) {
  const plane = useGLTF(PLANE).scene
  const me = useGLTF(ME).scene
  const flowers = useGLTF(FLOWERS).scene
  const p = useMemo(() => plane.clone(true), [plane])
  const him = useMemo(() => me.clone(true), [me])
  const himRig = useRig(him)
  const planeRig = useRig(p)
  const holder = useRef<THREE.Group>(null)

  // seat him in the cockpit, holding a lali gurans
  useMemo(() => {
    const [seat] = planeRig.get('seat')
    him.scale.setScalar(0.46)
    him.position.set(0, -0.24, 0)
    him.rotation.y = Math.PI / 2 - 0.7 // face the nose (+X), turned a little toward you
    seat.add(him)
    himRig.get('eyeX').forEach((o) => (o.visible = false))
    himRig.get('mouthOuch').forEach((o) => (o.visible = false))
    const gurans = flowers.children.find((c) => c.name === 'gurans')
    const blossom = gurans?.children.find((c) => c.userData.part === 'head')?.clone(true)
    const [elbowL] = himRig.get('elbowL')
    if (blossom && elbowL) {
      blossom.position.set(0, -0.24, 0.05)
      blossom.scale.setScalar(1.6)
      const petal = new THREE.MeshStandardMaterial({ color: '#e3173e', roughness: 0.45, side: THREE.DoubleSide })
      const green = new THREE.MeshStandardMaterial({ color: '#3f8a52', side: THREE.DoubleSide })
      blossom.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) m.material = m.userData.part === 'petal' ? petal : m.userData.part === 'center' ? new THREE.MeshStandardMaterial({ color: '#ffe08a' }) : green
      })
      elbowL.add(blossom)
    }
  }, [planeRig, himRig, him, flowers])

  // route as a dotted line: travelled part in pink, the rest faint
  const pts = useMemo(() => ROUTE.getPoints(60), [])
  const split = Math.max(1, Math.round(progress * 60))
  const done = pts.slice(0, split + 1)
  const ahead = pts.slice(split)

  const banner = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    const g = c.getContext('2d')!
    g.fillStyle = '#fff8ef'
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = '#c2547f'
    g.font = 'bold 60px Nunito, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('Coming ♡', 256, 84)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const geo = new THREE.PlaneGeometry(0.85, 0.27, 24, 1)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
    return { mesh, base: Float32Array.from(geo.attributes.position.array as Float32Array) }
  }, [])

  const hearts = useRef<THREE.Group>(null)
  const heartGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, -0.05)
    s.bezierCurveTo(-0.08, 0.0, -0.05, 0.06, 0, 0.03)
    s.bezierCurveTo(0.05, 0.06, 0.08, 0.0, 0, -0.05)
    return new THREE.ShapeGeometry(s)
  }, [])
  const trail = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ age: i / 7, x: 0, y: 0, z: 0 })), [])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), tan: new THREE.Vector3() }), [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const h = holder.current
    if (!h) return
    // where on the route; arrived → parked next to her
    const u = arrived ? 1 : Math.min(0.97, Math.max(0.03, progress))
    ROUTE.getPoint(u, tmp.a)
    ROUTE.getTangent(u, tmp.tan)
    h.position.copy(tmp.a)
    if (arrived) h.position.x -= 0.22 // parked beside her, not in her
    else h.position.y += Math.sin(t * 1.6) * 0.05
    h.rotation.set(0, 0, 0)
    h.rotation.z = arrived ? 0 : Math.atan2(tmp.tan.y, tmp.tan.x) * 0.8 + Math.sin(t * 1.3) * 0.06 // pitch along the path
    h.rotation.x = arrived ? 0 : Math.sin(t * 0.9) * 0.15 // gentle banking wobble
    h.rotation.y = -0.35 // three-quarter view so you can see him in the cockpit
    planeRig.get('propeller').forEach((pr) => (pr.rotation.x += dt * 30))

    // him: waving with the free hand, flower held high
    const [armL] = himRig.get('armL')
    const [armR] = himRig.get('armR')
    const [elbowR] = himRig.get('elbowR')
    armL.rotation.z = himRig.rest.get(armL)!.z + 2.2
    armR.rotation.z = himRig.rest.get(armR)!.z - 2.4
    elbowR.rotation.z = himRig.rest.get(elbowR)!.z - 0.4 - Math.sin(t * 7) * 0.45
    himRig.get('eye').forEach((e) => (e.scale.y = 0.35)) // happy squint

    // banner trailing behind the tail, rippling
    const pos = banner.mesh.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = banner.base[i * 3]
      pos.setZ(i, Math.sin(x * 9 - t * 8) * 0.05 * (0.45 - x))
    }
    pos.needsUpdate = true

    // little hearts puffing out behind the plane
    const hg = hearts.current
    if (hg) {
      trail.forEach((p2, i) => {
        p2.age += dt * 0.6
        if (p2.age >= 1) {
          p2.age -= 1
          h.localToWorld(tmp.a.set(-0.85, 0.05 + Math.random() * 0.1, 0))
          p2.x = tmp.a.x
          p2.y = tmp.a.y
          p2.z = tmp.a.z
        }
        const m = hg.children[i] as THREE.Mesh
        m.position.set(p2.x - p2.age * 0.15, p2.y + p2.age * 0.35, p2.z)
        m.scale.setScalar(0.6 + p2.age * 0.8)
        ;(m.material as THREE.MeshBasicMaterial).opacity = arrived ? 0 : 1 - p2.age
      })
    }
  })

  return (
    <>
      <Line points={done} color="#ff6f9f" lineWidth={3} />
      <Line points={ahead} color="#ffffff" lineWidth={2} dashed dashSize={0.06} gapSize={0.06} transparent opacity={0.7} />
      <group ref={holder} scale={0.5}>
        <primitive object={p} />
        <group position={[-1.53, 0.05, 0]}>
          <primitive object={banner.mesh} />
        </group>
        {/* tow rope */}
        <mesh position={[-1.0, 0.05, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.006, 0.006, 0.42, 4]} />
          <meshBasicMaterial color="#8a6a5a" />
        </mesh>
      </group>
      <group ref={hearts}>
        {trail.map((_, i) => (
          <mesh key={i} geometry={heartGeo}>
            <meshBasicMaterial color="#ff5f93" transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
  )
}
