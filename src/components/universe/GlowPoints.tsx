import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'

const vertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aTwinkle;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 1.0 - aTwinkle * (0.5 + 0.5 * sin(uTime * (0.9 + aPhase * 1.3) + aPhase * 6.2831));
    gl_PointSize = aSize * uPixelRatio * uScale * (0.8 + 0.2 * tw) * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = tw;
  }
`

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.32, 0.0, d);
    float halo = pow(max(1.0 - d, 0.0), 2.6) * 0.55;
    float a = (core + halo) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4((vColor + core * 0.7) * a, 1.0);
  }
`

/**
 * A ShaderMaterial owned by the component. Passing `uniforms` as a JSX prop makes R3F copy them,
 * so per-frame updates and tweens on our object would never reach the GPU — we create it ourselves.
 */
export function useShaderMaterial(params: THREE.ShaderMaterialParameters, additive = true) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: additive,
        depthWrite: !additive,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        ...params,
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

/** Keeps uTime (and uPixelRatio, if present) current. */
export function useShaderClock(material: THREE.ShaderMaterial) {
  useFrame(({ clock, viewport }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    if (material.uniforms.uPixelRatio) material.uniforms.uPixelRatio.value = viewport.dpr
  })
}

export interface GlowPointsProps {
  positions: Float32Array
  sizes: Float32Array
  colors: Float32Array
  phases?: Float32Array
  twinkle?: Float32Array
  /** Initial opacity; animate it via `materialRef.current.uniforms.uOpacity`. */
  opacity?: number
  scale?: number
  materialRef?: RefObject<THREE.ShaderMaterial | null>
}

/** Soft, additive, twinkling point sprites — used for every star in the app. */
export function GlowPoints({ positions, sizes, colors, phases, twinkle, opacity = 1, scale = 1, materialRef }: GlowPointsProps) {
  const geometry = useMemo(() => {
    const n = positions.length / 3
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases ?? new Float32Array(n).map((_, i) => (i * 0.618) % 1), 1))
    g.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle ?? new Float32Array(n).fill(0.25), 1))
    return g
  }, [positions, sizes, colors, phases, twinkle])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uScale: { value: 1 }, uOpacity: { value: opacity } },
  })
  material.uniforms.uScale.value = scale
  useShaderClock(material)
  useLayoutEffect(() => {
    if (materialRef) materialRef.current = material
  }, [material, materialRef])

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/** Raw (non-linearised) RGB for custom shaders, which write straight to the sRGB canvas. */
export function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace)
  return [c.r, c.g, c.b]
}
