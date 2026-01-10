import { useRef, useCallback } from 'react'
import { useAudio } from '@/contexts/AudioContext'

export interface AudioReactiveValues {
  // Sphere uniforms
  sphereStrength: number
  sphereTimeFrequency: number
  // Ring values
  ringSpeedMultiplier: number
  ringScaleMultiplier: number
  // Particle values
  particleRotationSpeed: number
}

// Spring state tracks both value and velocity for momentum
interface SpringValue {
  value: number
  velocity: number
}

interface SpringState {
  sphereStrength: SpringValue
  sphereTimeFrequency: SpringValue
  ringSpeedMultiplier: SpringValue
  ringScaleMultiplier: SpringValue
  particleRotationSpeed: SpringValue
}

// Spring configuration per property
interface SpringConfig {
  stiffness: number // Higher = faster response
  damping: number // Higher = less oscillation
}

const SPRING_CONFIGS: Record<keyof AudioReactiveValues, SpringConfig> = {
  sphereStrength: { stiffness: 150, damping: 12 }, // Fast, bouncy for bass
  sphereTimeFrequency: { stiffness: 100, damping: 16 }, // Medium, smooth
  ringSpeedMultiplier: { stiffness: 80, damping: 18 }, // Slower, flowing
  ringScaleMultiplier: { stiffness: 120, damping: 14 }, // Snappy with bounce
  particleRotationSpeed: { stiffness: 60, damping: 20 }, // Very smooth
}

// Idle/rest values
const IDLE_VALUES: AudioReactiveValues = {
  sphereStrength: 0.15,
  sphereTimeFrequency: 0.2,
  ringSpeedMultiplier: 0.5,
  ringScaleMultiplier: 1.0,
  particleRotationSpeed: 0.05,
}

// Create initial spring state from idle values
function createInitialSpringState(): SpringState {
  return {
    sphereStrength: { value: IDLE_VALUES.sphereStrength, velocity: 0 },
    sphereTimeFrequency: { value: IDLE_VALUES.sphereTimeFrequency, velocity: 0 },
    ringSpeedMultiplier: { value: IDLE_VALUES.ringSpeedMultiplier, velocity: 0 },
    ringScaleMultiplier: { value: IDLE_VALUES.ringScaleMultiplier, velocity: 0 },
    particleRotationSpeed: { value: IDLE_VALUES.particleRotationSpeed, velocity: 0 },
  }
}

// Spring physics update - simulates a damped harmonic oscillator
function updateSpring(
  current: SpringValue,
  target: number,
  delta: number,
  config: SpringConfig,
): SpringValue {
  // Clamp delta to prevent instability with large time steps
  const dt = Math.min(delta, 0.033) // Cap at ~30fps worth of time

  // Spring force: F = -k * (x - target)
  const displacement = current.value - target
  const springForce = -config.stiffness * displacement

  // Damping force: F = -c * v
  const dampingForce = -config.damping * current.velocity

  // Total acceleration (mass = 1)
  const acceleration = springForce + dampingForce

  // Integrate velocity and position (semi-implicit Euler for stability)
  const newVelocity = current.velocity + acceleration * dt
  const newValue = current.value + newVelocity * dt

  return { value: newValue, velocity: newVelocity }
}

export function useAudioReactive() {
  const { isPlaying, getAudioData } = useAudio()
  const springState = useRef<SpringState>(createInitialSpringState())
  const timeRef = useRef(0)

  const update = useCallback(
    (delta: number): AudioReactiveValues => {
      timeRef.current += delta

      // Calculate target values based on audio or idle state
      let targets: AudioReactiveValues

      if (isPlaying) {
        const audio = getAudioData()

        // Map audio frequencies to animation targets
        targets = {
          sphereStrength: 0.15 + audio.bass * 0.5,
          sphereTimeFrequency: 0.2 + audio.bass * 0.6,
          ringSpeedMultiplier: 0.5 + audio.mid * 2.0,
          ringScaleMultiplier: 1.0 + audio.high * 0.5,
          particleRotationSpeed: 0.05 + audio.amplitude * 0.3,
        }
      } else {
        // Add subtle breathing animation when idle
        const breathe = Math.sin(timeRef.current * 0.5) * 0.02
        targets = {
          sphereStrength: IDLE_VALUES.sphereStrength + breathe,
          sphereTimeFrequency: IDLE_VALUES.sphereTimeFrequency,
          ringSpeedMultiplier: IDLE_VALUES.ringSpeedMultiplier,
          ringScaleMultiplier: IDLE_VALUES.ringScaleMultiplier + breathe * 0.5,
          particleRotationSpeed: IDLE_VALUES.particleRotationSpeed,
        }
      }

      // Update each spring with its own configuration
      const state = springState.current
      const keys = Object.keys(SPRING_CONFIGS) as (keyof AudioReactiveValues)[]

      for (const key of keys) {
        state[key] = updateSpring(
          state[key],
          targets[key],
          delta,
          SPRING_CONFIGS[key],
        )
      }

      // Extract just the values for the return interface
      return {
        sphereStrength: state.sphereStrength.value,
        sphereTimeFrequency: state.sphereTimeFrequency.value,
        ringSpeedMultiplier: state.ringSpeedMultiplier.value,
        ringScaleMultiplier: state.ringScaleMultiplier.value,
        particleRotationSpeed: state.particleRotationSpeed.value,
      }
    },
    [isPlaying, getAudioData],
  )

  return { update, isPlaying }
}
