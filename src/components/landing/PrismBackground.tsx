import { useRef } from 'react'
import { Canvas, useFrame, extend, type ThreeElement } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

// User's parameters
const HEIGHT = 4.5
const BASE_WIDTH = 6
const BASE_HALF = BASE_WIDTH * 0.5
const SCALE = 4.0

// Derived values
const INV_HEIGHT = 1 / HEIGHT
const INV_BASE_HALF = 1 / BASE_HALF
const MIN_AXIS = Math.min(BASE_HALF, HEIGHT)
const CENTER_SHIFT = HEIGHT * 0.25

// ReactBits Prism shader material - exact port
const PrismShaderMaterial = shaderMaterial(
  {
    iTime: 0,
    iResolution: new THREE.Vector2(1, 1),
    uHeight: HEIGHT,
    uInvHeight: INV_HEIGHT,
    uInvBaseHalf: INV_BASE_HALF,
    uMinAxis: MIN_AXIS,
    uPxScale: 0.01,
    uCenterShift: CENTER_SHIFT,
    uRot: new THREE.Matrix3(),
    uUseBaseWobble: 1,
    uGlow: 0.5,
    uOffsetPx: new THREE.Vector2(0, 0),
    uNoise: 0.05,
    uSaturation: 1.0,
    uColorFreq: 1.3,
    uBloom: 1.0,
    uHueShift: 0.0,
    uTimeScale: 0.2,
  },
  // Vertex Shader
  `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
  `,
  // Fragment Shader - exact ReactBits implementation
  `
  precision highp float;

  uniform vec2  iResolution;
  uniform float iTime;

  uniform float uHeight;
  uniform float uInvBaseHalf;
  uniform float uInvHeight;
  uniform float uMinAxis;
  uniform mat3  uRot;
  uniform int   uUseBaseWobble;
  uniform float uGlow;
  uniform vec2  uOffsetPx;
  uniform float uNoise;
  uniform float uSaturation;
  uniform float uPxScale;
  uniform float uHueShift;
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

  mat3 hueRotation(float a){
    float c = cos(a), s = sin(a);
    mat3 W = mat3(
      0.299, 0.587, 0.114,
      0.299, 0.587, 0.114,
      0.299, 0.587, 0.114
    );
    mat3 U = mat3(
       0.701, -0.587, -0.114,
      -0.299,  0.413, -0.114,
      -0.300, -0.588,  0.886
    );
    mat3 V = mat3(
       0.168, -0.331,  0.500,
       0.328,  0.035, -0.500,
      -0.497,  0.296,  0.201
    );
    return W + U * c + V * s;
  }

  void main(){
    vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

    float z = 5.0;
    float d = 0.0;

    vec3 p;
    vec4 o = vec4(0.0);

    float centerShift = uCenterShift;
    float cf = uColorFreq;

    mat2 wob = mat2(1.0);
    if (uUseBaseWobble == 1) {
      float t = iTime * uTimeScale;
      float c0 = cos(t + 0.0);
      float c1 = cos(t + 33.0);
      float c2 = cos(t + 11.0);
      wob = mat2(c0, c1, c2, c0);
    }

    const int STEPS = 100;
    for (int i = 0; i < STEPS; i++) {
      p = vec3(f, z);
      p.xz = p.xz * wob;
      p = uRot * p;
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

    if(abs(uHueShift) > 0.0001){
      col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
    }

    gl_FragColor = vec4(col, 1.0);
  }
  `,
)

// Extend the material for R3F
extend({ PrismShaderMaterial })

// Type definition for custom shader material
declare module '@react-three/fiber' {
  interface ThreeElements {
    prismShaderMaterial: ThreeElement<typeof PrismShaderMaterial>
  }
}

function PrismPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock, size }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.iResolution.value.set(size.width, size.height)
      // Calculate pixel scale based on canvas height and scale factor
      materialRef.current.uniforms.uPxScale.value = 1 / (size.height * 0.1 * SCALE)
    }
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <prismShaderMaterial ref={materialRef} />
    </mesh>
  )
}

export function PrismBackground() {
  return (
    <div className="absolute inset-0 w-full h-full -z-10">
      <Canvas
        camera={{ position: [0, 0, 1], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <PrismPlane />
      </Canvas>
    </div>
  )
}
