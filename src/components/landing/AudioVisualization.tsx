import { useRef, useMemo, useState, useEffect, createContext, useContext } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Mic } from 'lucide-react'
import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useAudioReactive, type AudioReactiveValues } from '@/hooks/useAudioReactive'

// --- Audio Reactive Context ---
interface AudioReactiveContextType {
  valuesRef: React.MutableRefObject<AudioReactiveValues>
}

const AudioReactiveContext = createContext<AudioReactiveContextType | null>(null)

function useAudioReactiveContext() {
  const context = useContext(AudioReactiveContext)
  if (!context) {
    // Return default values if no provider (fallback for standalone use)
    return {
      valuesRef: {
        current: {
          sphereStrength: 0.15,
          sphereTimeFrequency: 0.2,
          ringSpeedMultiplier: 0.5,
          ringScaleMultiplier: 1.0,
          particleRotationSpeed: 0.05,
        },
      },
    }
  }
  return context
}

function AudioReactiveProvider({ children }: { children: React.ReactNode }) {
  const { update } = useAudioReactive()
  const valuesRef = useRef<AudioReactiveValues>({
    sphereStrength: 0.15,
    sphereTimeFrequency: 0.2,
    ringSpeedMultiplier: 0.5,
    ringScaleMultiplier: 1.0,
    particleRotationSpeed: 0.05,
  })

  useFrame((_, delta) => {
    valuesRef.current = update(delta)
  })

  return (
    <AudioReactiveContext.Provider value={{ valuesRef }}>
      {children}
    </AudioReactiveContext.Provider>
  )
}

// --- Vertex Shader ---
const wobbleVertexShader = `
  uniform float uTime;
  uniform float uPositionFrequency;
  uniform float uTimeFrequency;
  uniform float uStrength;
  uniform float uWarpPositionFrequency;
  uniform float uWarpTimeFrequency;
  uniform float uWarpStrength;
  
  attribute vec4 tangent;
  varying float vWobble;

  // Simplex Noise 4D
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float permute(float x) { return floor(mod(((x*34.0)+1.0)*x, 289.0)); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

  vec4 grad4(float j, vec4 ip)
  {
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p,s;

    p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www; 

    return p;
  }

  float simplexNoise4d(vec4 v)
  {
    const vec2  C = vec2( 0.138196601125010504,  // (5 - sqrt(5))/20  G4
                          0.309016994374947451); // (sqrt(5) - 1)/4   F4
    // First corner
    vec4 i  = floor(v + dot(v, C.yyyy) );
    vec4 x0 = v -   i + dot(i, C.xxxx);

    // Other corners

    // Rank sorting originally contributes to the blindness of the following if/else chain.
    // Determine which simplex we are in.
    // [0,0,0,0] is the base corner.
    // [1,0,0,0] [0,1,0,0] [0,0,1,0] [0,0,0,1] are the 4 simplex corners.
    // There are 24 such corners.
    // This is the optimized version of the sorting network below
    vec4 i0;

    vec3 isX = step( x0.yzw, x0.xxx );
    vec3 isYZ = step( x0.zww, x0.yyz );
    //  i0.x = dot( isX, vec3( 1.0 ) );
    i0.x = isX.x + isX.y + isX.z;
    i0.yzw = 1.0 - isX;

    //  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
    i0.y += isYZ.x + isYZ.y;
    i0.zw += 1.0 - isYZ.xy;

    i0.z += isYZ.z;
    i0.w += 1.0 - isYZ.z;

    // i0 now contains the unique values 0,1,2,3 in each channel
    vec4 i3 = clamp( i0, 0.0, 1.0 );
    vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
    vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

    //  x0 = x0 - 0.0 + 0.0 * C 
    vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
    vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
    vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
    vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;

    // Permutations
    i = mod(i, 289.0); 
    float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute( permute( permute( permute (
              i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
            + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
            + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
            + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
    // Gradients
    // ( 7*7*6 points uniformly over a cube, mapped onto a 4-cross polytope.)
    // 7*7*6 = 294, which is close to the ring size 17*17 = 289.

    vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

    vec4 p0 = grad4(j0,   ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    p4 *= taylorInvSqrt(dot(p4,p4));

    // Mix contributions from the five corners
    vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
    m0 = m0 * m0;
    m1 = m1 * m1;
    return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
                  + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

  }

  float getWobble(vec3 position)
  {
      vec3 warpedPosition = position;
      warpedPosition += simplexNoise4d(
          vec4(
              position * uWarpPositionFrequency,
              uTime * uWarpTimeFrequency
          )
      ) * uWarpStrength;
      
      return simplexNoise4d(vec4(
          warpedPosition * uPositionFrequency, // XYZ
          uTime * uTimeFrequency         // W
      )) * uStrength;
  }

  void main() {
    vec3 biTangent = cross(normal, tangent.xyz);
    
    // Neighbours positions    
    float shift = 0.01;
    vec3 positionA = csm_Position + tangent.xyz * shift;
    vec3 positionB = csm_Position + biTangent * shift;

    // Wobble
    float wobble = getWobble(csm_Position);
    csm_Position += wobble * normal;
    
    positionA += getWobble(positionA) * normal;
    positionB += getWobble(positionB) * normal;
    
    // Compute normal
    vec3 toA = normalize(positionA - csm_Position);
    vec3 toB = normalize(positionB - csm_Position);
    csm_Normal = cross(toA, toB);
    
    // Varying
    vWobble = wobble / uStrength;
  }
`

// --- Fragment Shader ---
const wobbleFragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  
  varying float vWobble;

  void main() {
    float colorMix = smoothstep(-1.0, 1.0, vWobble);
    csm_DiffuseColor.rgb = mix(uColorA, uColorB, colorMix);
    
    // Shiny tip
    csm_Roughness = 1.0 - colorMix;
  }
`

// --- Components ---

function LivingCore() {
  const mesh = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)
  const { valuesRef } = useAudioReactiveContext()

  // Create base geometry with tangents - reduced subdivision for performance
  const geometry = useMemo(() => {
    const icosahedron = new THREE.IcosahedronGeometry(1.5, 24) // Reduced from 32
    const geo = mergeVertices(icosahedron)
    geo.computeTangents()
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPositionFrequency: { value: 0.5 },
      uTimeFrequency: { value: 0.4 },
      uStrength: { value: 0.3 },
      uWarpPositionFrequency: { value: 0.38 },
      uWarpTimeFrequency: { value: 0.12 },
      uWarpStrength: { value: 1.7 },
      uColorA: { value: new THREE.Color('#5a7ba6') },
      uColorB: { value: new THREE.Color('#93c5fd') },
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (materialRef.current) {
      const values = valuesRef.current
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
      materialRef.current.uniforms.uStrength.value = values.sphereStrength
      materialRef.current.uniforms.uTimeFrequency.value = values.sphereTimeFrequency
    }
  })

  return (
    <mesh ref={mesh} geometry={geometry}>
      <CustomShaderMaterial
        ref={materialRef}
        baseMaterial={THREE.MeshStandardMaterial}
        vertexShader={wobbleVertexShader}
        fragmentShader={wobbleFragmentShader}
        uniforms={uniforms}
        metalness={0}
        roughness={0.5}
        transparent
      />
    </mesh>
  )
}

function Particles() {
  const count = 30 // Reduced from 40
  const points = useRef<THREE.Points>(null)
  const { valuesRef } = useAudioReactiveContext()

  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sc = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      sc[i] = Math.random()
    }
    return [pos, sc]
  }, [])

  // Create circular texture for particles
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.arc(16, 16, 14, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame(({ clock }) => {
    if (points.current) {
      const values = valuesRef.current
      const t = clock.getElapsedTime() * values.particleRotationSpeed
      points.current.rotation.y = t
      points.current.rotation.x = t * 0.5
    }
  })

  // Create buffer geometry with attributes
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('scale', new THREE.BufferAttribute(scales, 1))
    return geo
  }, [positions, scales])

  return (
    <points ref={points} geometry={particleGeometry}>
      <pointsMaterial
        size={0.15}
        map={particleTexture}
        color="#a5b4fc"
        transparent
        alphaMap={particleTexture}
        alphaTest={0.001}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function BreathingRings() {
  const group = useRef<THREE.Group>(null)
  const { valuesRef } = useAudioReactiveContext()

  useFrame(({ clock }) => {
    if (group.current) {
      const values = valuesRef.current
      const t = clock.getElapsedTime() * values.ringSpeedMultiplier
      group.current.rotation.z = Math.sin(t * 0.2) * 0.2
      group.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.1
    }
  })

  return (
    <group ref={group} rotation-x={Math.PI / 2}>
      {[0, 1, 2].map((i) => (
        <Ring key={i} index={i} total={3} />
      ))}
    </group>
  )
}

function Ring({ index, total }: { index: number; total: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const { valuesRef } = useAudioReactiveContext()
  const delay = index * (2 / total)

  useFrame(({ clock }) => {
    if (mesh.current) {
      const values = valuesRef.current
      const t = clock.getElapsedTime() * values.ringSpeedMultiplier
      const cycle = (t + delay) % 3
      const progress = cycle / 3

      const baseScale = 2 + progress * 2.5
      const scale = baseScale * values.ringScaleMultiplier
      mesh.current.scale.set(scale, scale, scale)

      const opacity = Math.max(0, 0.3 * (1 - progress))
      ;(mesh.current.material as THREE.MeshBasicMaterial).opacity = opacity
    }
  })

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.98, 1, 64]} /> {/* Reduced from 128 */}
      <meshBasicMaterial
        color="#7e9ec9"
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// Scene content - exported for use in combined canvas
export function AudioVisualizationScene() {
  return (
    <AudioReactiveProvider>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />

      {/* Core Scene */}
      <LivingCore />

      <Particles />
      <BreathingRings />
    </AudioReactiveProvider>
  )
}

// Standalone component with its own canvas - for use outside HeroSection
export function AudioVisualization() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Delay mount until after Framer Motion scale animation completes
    // Animation: 200ms delay + 800ms duration = 1000ms total
    const timer = setTimeout(() => {
      setMounted(true)
    }, 1050)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="absolute inset-0">
      {/* Canvas layer */}
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{
            powerPreference: 'high-performance',
            antialias: false,
            stencil: false,
            depth: true,
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          <AudioVisualizationScene />
        </Canvas>
      )}

      {/* Overlay - centered mic icon */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          <Mic className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </div>
      </div>
    </div>
  )
}
