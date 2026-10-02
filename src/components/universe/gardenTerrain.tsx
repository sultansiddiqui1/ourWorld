import { useMemo } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../../lib/random'

/** Height of the meadow at world (x, z). Deterministic so chunks stitch seamlessly. */
export function groundHeight(x: number, z: number) {
  const roll = 0.06 * Math.sin(x * 0.9) + 0.045 * Math.sin(x * 0.37 + 1.3) + 0.025 * Math.sin(x * 2.1 + z * 1.7)
  const back = z < -1.2 ? Math.pow(-z - 1.2, 1.5) * 0.16 : 0
  const front = z > 1.1 ? -(z - 1.1) * 0.22 : 0
  return roll + back + front
}

const GRASS = ['#24573b', '#2a6142', '#2f6a47', '#275b3e']
const tmpColor = new THREE.Color()

/** A 40-unit wide strip of low-poly meadow centred on `center` (world x). */
export function Meadow({ center }: { center: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(40, 7, 90, 16).rotateX(-Math.PI / 2).toNonIndexed()
    const pos = g.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + center
      const z = pos.getZ(i)
      const jitter = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      pos.setX(i, x)
      pos.setY(i, groundHeight(x, z) + jitter * 0.03)
    }
    // flat colour per triangle for the faceted look
    for (let f = 0; f < pos.count; f += 3) {
      const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3
      const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3
      const n = Math.abs(Math.sin(cx * 3.1 + cz * 5.7) * 43758.5453) % 1
      tmpColor.set(GRASS[Math.floor(n * GRASS.length)])
      const shade = cz < -1.5 ? 0.7 : 0.9 + 0.1 * n
      for (let k = 0; k < 3; k++) colors.set([tmpColor.r * shade, tmpColor.g * shade, tmpColor.b * shade], (f + k) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [center])

  const grass = useMemo(() => {
    const blades: { x: number; z: number; s: number; r: number; c: number; tx: number; tz: number }[] = []
    // one seeded cell per world unit → blades never pop when chunks change
    for (let cell = Math.floor(center - 20); cell < center + 20; cell++) {
      const rnd = mulberry32(cell * 7919 + 17)
      for (let k = 0; k < 26; k++) {
        blades.push({ x: cell + rnd(), z: -1.8 + rnd() * 3.2, s: 0.6 + rnd() * 0.9, r: rnd() * Math.PI, c: Math.floor(rnd() * GRASS.length), tx: rnd() - 0.5, tz: rnd() - 0.5 })
      }
    }
    return blades
  }, [center])

  const grassMesh = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.012, 0.13, 3).translate(0, 0.065, 0)
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, emissive: '#12301f' })
    const mesh = new THREE.InstancedMesh(geo, mat, grass.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    grass.forEach((b, i) => {
      e.set(b.tx * 0.4, b.r, b.tz * 0.4)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(b.x, groundHeight(b.x, b.z), b.z), q, new THREE.Vector3(b.s, b.s, b.s))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, tmpColor.set(GRASS[b.c]).multiplyScalar(1.6))
    })
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [grass])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <primitive object={grassMesh} />
    </group>
  )
}

/** Silhouette ridge line: rolling hills nearby, jagged Himalaya far away. */
function ridgeHeight(x: number, jagged: boolean) {
  if (!jagged) return 0.35 + 0.22 * Math.sin(x * 0.31 + 0.4) + 0.14 * Math.sin(x * 0.83 + 2.1)
  // 1 - |sin| makes sharp summits; layered octaves give a Himalayan skyline
  const peak = (f: number, o: number) => Math.pow(1 - Math.abs(Math.sin(x * f + o)), 2.2)
  return 0.7 + peak(0.42, 0) * 2.4 + peak(0.97, 1.3) * 1.0 + peak(2.3, 0.4) * 0.3
}

const SNOW_DEPTH = 0.45

export function Ridge({ center, z, jagged, color, snow }: { center: number; z: number; jagged: boolean; color: string; snow?: string }) {
  const geometry = useMemo(() => {
    const half = jagged ? 70 : 45
    const step = jagged ? 0.12 : 0.5
    const x0 = Math.floor((center - half) / step) * step
    const verts: number[] = []
    const cols: number[] = []
    const base = new THREE.Color(color).toArray()
    const top = new THREE.Color(snow ?? color)
    const quad = (xa: number, ya1: number, ya2: number, xb: number, yb1: number, yb2: number, ca1: number[], ca2: number[], cb1: number[], cb2: number[]) => {
      verts.push(xa, ya1, 0, xb, yb1, 0, xb, yb2, 0, xa, ya1, 0, xb, yb2, 0, xa, ya2, 0)
      cols.push(...ca1, ...cb1, ...cb2, ...ca1, ...cb2, ...ca2)
    }
    for (let x = x0; x < center + half; x += step) {
      const x2 = x + step
      const h1 = ridgeHeight(x, jagged)
      const h2 = ridgeHeight(x2, jagged)
      if (!jagged) {
        quad(x, -1, h1, x2, -1, h2, base, base, base, base)
        continue
      }
      // body up to the snowline, then a thin snow cap that only shows on the tall peaks
      const s1 = h1 - SNOW_DEPTH
      const s2 = h2 - SNOW_DEPTH
      const cap = (h: number) => new THREE.Color(color).lerp(top, THREE.MathUtils.smoothstep(h, 2.1, 3.0)).toArray()
      quad(x, -1, s1, x2, -1, s2, base, base, base, base)
      quad(x, s1, h1, x2, s2, h2, base, cap(h1), base, cap(h2))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    return g
  }, [center, jagged, color, snow])
  return (
    <mesh geometry={geometry} position={[0, 0, z]}>
      <meshBasicMaterial vertexColors />
    </mesh>
  )
}
