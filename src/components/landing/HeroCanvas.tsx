import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================================================
// PRISM BACKGROUND SHADER
// ============================================================================

const HEIGHT = 4.5
const BASE_WIDTH = 6
const BASE_HALF = BASE_WIDTH * 0.5
const SCALE = 4.0
const INV_HEIGHT = 1 / HEIGHT
const INV_BASE_HALF = 1 / BASE_HALF
const MIN_AXIS = Math.min(BASE_HALF, HEIGHT)
const CENTER_SHIFT = HEIGHT * 0.25

const prismVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const prismFragmentShader = `
  precision highp float;

  uniform vec2  iResolution;
  uniform float iTime;
  uniform float uHeight;
  uniform float uInvBaseHalf;
  uniform float uInvHeight;
  uniform float uMinAxis;
  uniform float uGlow;
  uniform float uNoise;
  uniform float uSaturation;
  uniform float uPxScale;
  uniform float uColorFreq;
  uniform float uBloom;
  uniform float uCenterShift;
  uniform float uTimeScale;

  vec4 tanh4(vec4 x){
    vec4 e2x = exp(2.0*x);
    return (e2x - 1.0) / (e2x + 1.0);
  }

  float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float sdOctaAnisoInv(vec3 p){
    vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
    float m = q.x + q.y + q.z - 1.0;
    return m * uMinAxis * 0.5773502691896258;
  }

  float sdPyramidUpInv(vec3 p){
    float oct = sdOctaAnisoInv(p);
    float halfSpace = -p.y;
    return max(oct, halfSpace);
  }

  void main(){
    vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy) * uPxScale;

    float z = 5.0;
    float d = 0.0;

    vec3 p;
    vec4 o = vec4(0.0);

    float centerShift = uCenterShift;
    float cf = uColorFreq;

    float t = iTime * uTimeScale;
    float c0 = cos(t + 0.0);
    float c1 = cos(t + 33.0);
    float c2 = cos(t + 11.0);
    mat2 wob = mat2(c0, c1, c2, c0);

    const int STEPS = 40;
    for (int i = 0; i < STEPS; i++) {
      p = vec3(f, z);
      p.xz = p.xz * wob;
      vec3 q = p;
      q.y += centerShift;
      d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
      z -= d;
      o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
    }

    o = tanh4(o * o * (uGlow * uBloom) / 1e5);

    vec3 col = o.rgb;
    float n = rand(gl_FragCoord.xy + vec2(iTime));
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);

    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`

function PrismBackground() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(1, 1) },
      uHeight: { value: HEIGHT },
      uInvHeight: { value: INV_HEIGHT },
      uInvBaseHalf: { value: INV_BASE_HALF },
      uMinAxis: { value: MIN_AXIS },
      uPxScale: { value: 0.01 },
      uCenterShift: { value: CENTER_SHIFT },
      uGlow: { value: 0.5 },
      uNoise: { value: 0.05 },
      uSaturation: { value: 1.0 },
      uColorFreq: { value: 1.3 },
      uBloom: { value: 1.0 },
      uTimeScale: { value: 0.2 },
    }),
    [],
  )

  useFrame(({ clock, size }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.iResolution.value.set(
        size.width,
        size.height,
      )
      materialRef.current.uniforms.uPxScale.value =
        1 / (size.height * 0.1 * SCALE)
    }
  })

  return (
    <mesh renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={prismVertexShader}
        fragmentShader={prismFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

// ============================================================================
// MAIN EXPORT - Background Canvas
// ============================================================================

export function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{
        powerPreference: 'high-performance',
        antialias: false,
        stencil: false,
        depth: true,
        alpha: false,
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
      }}
    >
      {/* Background layer */}
      <PrismBackground />
    </Canvas>
  )
}
