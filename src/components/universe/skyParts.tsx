import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { GlowPoints, hexToRgb, useShaderClock, useShaderMaterial } from './GlowPoints'

const STAR_TINTS = ['#ffffff', '#dfe8ff', '#cad8ff', '#fff2dc', '#ffe0ef']

/** Deep field of twinkling stars, denser along a diagonal "milky way" band. */
export function BackgroundStars({ count = 1400, width = 44, height = 34, zMin = -40, zMax = -8, seed = 1 }) {
  const data = useMemo(() => {
    let s = seed
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const twinkle = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      let x = (rnd() - 0.5) * width
      let y = (rnd() - 0.5) * height
      if (i % 3 === 0) {
        // pull a third of the stars toward the band y = -0.45x
        const t = (rnd() - 0.5) * width
        x = t
        y = -0.45 * t + (rnd() - 0.5) * (rnd() * 6)
      }
      positions.set([x, y, zMin + rnd() * (zMax - zMin)], i * 3)
      const big = rnd() < 0.06
      sizes[i] = big ? 9 + rnd() * 8 : 3 + rnd() * 5
      const c = hexToRgb(STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)])
      const dim = big ? 1 : 0.45 + rnd() * 0.45
      colors.set([c[0] * dim, c[1] * dim, c[2] * dim], i * 3)
      twinkle[i] = 0.15 + rnd() * 0.6
      phases[i] = rnd()
    }
    return { positions, sizes, colors, twinkle, phases }
  }, [count, width, height, zMin, zMax, seed])
  return <GlowPoints {...data} />
}

const nebulaFrag = /* glsl */ `
  float sq(float x) { return x * x; } // pow() is undefined for negative bases
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = vUv * vec2(3.0, 2.2);
    float t = uTime * 0.012;
    float n = fbm(p + vec2(t, -t * 0.6) + fbm(p * 1.4 - t));
    // a soft band running across the frame, matching the dense star band
    float band = exp(-sq((vUv.y - (0.58 - (vUv.x - 0.5) * 0.45)) * 3.2));
    vec3 violet = vec3(0.23, 0.12, 0.42);
    vec3 blue = vec3(0.06, 0.14, 0.38);
    vec3 rose = vec3(0.42, 0.10, 0.28);
    vec3 col = mix(blue, violet, smoothstep(0.35, 0.75, n));
    col = mix(col, rose, smoothstep(0.62, 0.9, n) * 0.6);
    float a = smoothstep(0.28, 0.85, n) * (0.25 + band * 0.75);
    vec3 base = mix(vec3(0.016, 0.02, 0.06), vec3(0.04, 0.05, 0.14), 1.0 - vUv.y);
    gl_FragColor = vec4(base + col * a * 0.55, 1.0);
  }
`
const planeVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

/** Opaque painted backdrop: night gradient plus slowly drifting nebula. */
export function Nebula({ z = -45, width = 120, height = 90 }) {
  const material = useShaderMaterial({ vertexShader: planeVert, fragmentShader: nebulaFrag, uniforms: { uTime: { value: 0 } }, depthWrite: false }, false)
  useShaderClock(material)
  return (
    <mesh position={[0, 0, z]} material={material}>
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}

const flareFrag = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float pulse = 0.82 + 0.18 * sin(uTime * 1.5 + uPhase);
    float glow = exp(-r * r * 26.0) * 1.3 + exp(-r * 5.0) * 0.32;
    float spikes = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 2.8) + exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 2.8);
    vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
    float diag = exp(-abs(q.y) * 110.0) * exp(-abs(q.x) * 6.0) + exp(-abs(q.x) * 110.0) * exp(-abs(q.y) * 6.0);
    float a = (glow + spikes * 0.85 * pulse + diag * 0.35) * pulse * uOpacity;
    vec3 col = mix(uColor, vec3(1.0), clamp(exp(-r * r * 60.0), 0.0, 1.0));
    gl_FragColor = vec4(col * a, 1.0);
  }
`

/** The bright, pulsing four-point star used for each person's anchor. */
export function AnchorFlare({ color, size = 1.8, phase = 0, materialRef }: { color: string; size?: number; phase?: number; materialRef?: RefObject<THREE.ShaderMaterial | null> }) {
  const material = useShaderMaterial({
    vertexShader: planeVert,
    fragmentShader: flareFrag,
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Vector3() } },
  })
  material.uniforms.uPhase.value = phase
  material.uniforms.uColor.value.set(...hexToRgb(color))
  useShaderClock(material)
  useLayoutEffect(() => {
    if (materialRef) materialRef.current = material
  }, [material, materialRef])
  return (
    <Billboard>
      <mesh material={material}>
        <planeGeometry args={[size, size]} />
      </mesh>
    </Billboard>
  )
}

/** One cycle of the bridge animation: two sparks travel toward each other, meet, a heart blooms. */
const BRIDGE_PERIOD = 9.0

const bridgeVert = /* glsl */ `
  float sq(float x) { return x * x; } // pow() is undefined for negative bases
  attribute float aT;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uPeriod;
  varying float vT;
  varying float vPulse;
  void main() {
    float f = fract(uTime / uPeriod);
    float travel = smoothstep(0.0, 0.78, f) * 0.5;
    float fade = 1.0 - smoothstep(0.78, 0.86, f);
    float pa = exp(-sq((aT - travel) * 45.0));
    float pb = exp(-sq(((1.0 - aT) - travel) * 45.0));
    vPulse = (pa + pb) * fade;
    vT = aT;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float shimmer = 0.5 + 0.5 * sin(aT * 90.0 - uTime * 2.2);
    gl_PointSize = (3.4 + shimmer * 2.0 + vPulse * 6.0) * uPixelRatio * uScale * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const bridgeFrag = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vT;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.2);
    vec3 col = mix(uColorA, uColorB, vT);
    col = mix(col, vec3(1.0, 0.62, 0.8), clamp(vPulse, 0.0, 1.0));
    float alpha = a * (0.42 + vPulse * 0.45) * uOpacity;
    gl_FragColor = vec4(col * alpha, 1.0);
  }
`

const heartFrag = /* glsl */ `
  float sq(float x) { return x * x; } // pow() is undefined for negative bases
  uniform float uTime;
  uniform float uPeriod;
  uniform float uOpacity;
  varying vec2 vUv;
  float dot2(vec2 v) { return dot(v, v); }
  float sdHeart(vec2 p) {
    p.x = abs(p.x);
    if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
    return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
  }
  void main() {
    float f = fract(uTime / uPeriod);
    float flash = exp(-sq((f - 0.86) * 7.0));
    float grow = 0.75 + 0.35 * smoothstep(0.76, 0.9, f);
    vec2 p = (vUv - 0.5) * 2.6 / grow + vec2(0.0, 0.55);
    float d = sdHeart(p);
    float fill = smoothstep(0.02, -0.02, d);
    float glow = exp(-max(d, 0.0) * 9.0) * 0.6;
    float a = (fill + glow) * flash * uOpacity;
    gl_FragColor = vec4(vec3(1.0, 0.42, 0.62) * a * 1.2 + fill * flash * 0.25, 1.0);
  }
`

/** Arc of light between the two anchor stars. */
export function LightBridge({
  from,
  to,
  colorA,
  colorB,
  scale = 1,
  delay = 2.6,
}: {
  from: [number, number, number]
  to: [number, number, number]
  colorA: string
  colorB: string
  scale?: number
  /** Seconds before the bridge fades in. */
  delay?: number
}) {
  const { geometry, mid } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const m = a.clone().add(b).multiplyScalar(0.5)
    const dir = b.clone().sub(a)
    const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize()
    if (normal.y < 0) normal.negate()
    const control = m.clone().add(normal.multiplyScalar(dir.length() * 0.28)).add(new THREE.Vector3(0, 0, 1.2))
    const curve = new THREE.QuadraticBezierCurve3(a, control, b)
    const N = 160
    const pos = new Float32Array(N * 3)
    const ts = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const p = curve.getPoint(t)
      pos.set([p.x, p.y, p.z], i * 3)
      ts[i] = t
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aT', new THREE.BufferAttribute(ts, 1))
    return { geometry: g, mid: curve.getPoint(0.5) }
  }, [from, to])

  const material = useShaderMaterial({
    vertexShader: bridgeVert,
    fragmentShader: bridgeFrag,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uScale: { value: 1 },
      uPeriod: { value: BRIDGE_PERIOD },
      uOpacity: { value: 0 },
      uColorA: { value: new THREE.Vector3() },
      uColorB: { value: new THREE.Vector3() },
    },
  })
  const u = material.uniforms
  u.uScale.value = scale
  u.uColorA.value.set(...hexToRgb(colorA))
  u.uColorB.value.set(...hexToRgb(colorB))
  // the heart shares the bridge's clock and opacity uniforms
  const heart = useShaderMaterial({ vertexShader: planeVert, fragmentShader: heartFrag, uniforms: { uTime: u.uTime, uPeriod: u.uPeriod, uOpacity: u.uOpacity } })
  useShaderClock(material)

  useEffect(() => {
    const tween = gsap.to(u.uOpacity, { value: 1, duration: 2.5, delay, ease: 'sine.inOut' })
    return () => {
      tween.kill()
    }
  }, [u, delay])

  return (
    <group>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <Billboard position={mid}>
        <mesh material={heart}>
          <planeGeometry args={[1.5 * scale, 1.5 * scale]} />
        </mesh>
      </Billboard>
    </group>
  )
}

const streakFrag = /* glsl */ `
  float sq(float x) { return x * x; } // pow() is undefined for negative bases
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float tail = pow(vUv.x, 3.0);
    float core = exp(-sq((vUv.y - 0.5) * 8.0));
    float a = tail * core * uAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * a, 1.0);
  }
`

/** Every so often, a shooting star. */
export function ShootingStar({ area = [10, 7] as [number, number] }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useShaderMaterial({ vertexShader: planeVert, fragmentShader: streakFrag, uniforms: { uAlpha: { value: 0 } } })
  const uniforms = material.uniforms
  const state = useRef({ next: 3 + Math.random() * 5, start: -1, from: new THREE.Vector3(), dir: new THREE.Vector3() })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const s = state.current
    const m = mesh.current
    if (!m) return
    if (s.start < 0 && t > s.next) {
      s.start = t
      s.from.set((Math.random() * 0.6 + 0.1) * area[0] * 0.5, (Math.random() * 0.4 + 0.3) * area[1] * 0.5, -2)
      const ang = Math.PI + 0.35 + Math.random() * 0.35
      s.dir.set(Math.cos(ang), Math.sin(ang), 0)
      m.rotation.z = ang
    }
    if (s.start >= 0) {
      const p = (t - s.start) / 1.1
      if (p >= 1) {
        s.start = -1
        s.next = t + 7 + Math.random() * 10
        uniforms.uAlpha.value = 0
        return
      }
      m.position.copy(s.from).addScaledVector(s.dir, p * 6)
      uniforms.uAlpha.value = Math.sin(Math.PI * p) * 0.9
    }
  })
  return (
    <mesh ref={mesh} material={material}>
      <planeGeometry args={[1.6, 0.05]} />
    </mesh>
  )
}
