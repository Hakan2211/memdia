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

// Smoothing configuration per property
interface SmoothConfig {
  speed: number // 0-1, higher = faster response
  min: number // Minimum allowed value
  max: number // Maximum allowed value
}

const SMOOTH_CONFIGS: Record<keyof AudioReactiveValues, SmoothConfig> = {
  sphereStrength: { speed: 0.08, min: 0.1, max: 0.7 },
  sphereTimeFrequency: { speed: 0.06, min: 0.15, max: 0.9 },
  ringSpeedMultiplier: { speed: 0.05, min: 0.3, max: 3.0 },
  ringScaleMultiplier: { speed: 0.07, min: 0.8, max: 1.6 },
  particleRotationSpeed: { speed: 0.04, min: 0.03, max: 0.4 },
}

// Idle/rest values
const IDLE_VALUES: AudioReactiveValues = {
  sphereStrength: 0.15,
  sphereTimeFrequency: 0.2,
  ringSpeedMultiplier: 0.5,
  ringScaleMultiplier: 1.0,
  particleRotationSpeed: 0.05,
}

// Simple exponential smoothing - no velocity, no accumulation possible
function smoothValue(
  current: number,
  target: number,
  config: SmoothConfig,
): number {
  // Clamp target first to ensure we never chase an out-of-bounds value
  const clampedTarget = Math.max(config.min, Math.min(config.max, target))

  // Exponential smoothing: moves current toward target by a fraction each frame
  const newValue = current + (clampedTarget - current) * config.speed

  // Clamp output as safety net - this value can NEVER exceed bounds
  return Math.max(config.min, Math.min(config.max, newValue))
}

export function useAudioReactive() {
  const { isPlaying, getAudioData, loopCount } = useAudio()
  const smoothedValues = useRef<AudioReactiveValues>({ ...IDLE_VALUES })
  const timeRef = useRef(0)
  const lastLoopCountRef = useRef(loopCount)

  const update = useCallback(
    (delta: number): AudioReactiveValues => {
      timeRef.current += delta

      // Reset smoothed values when audio loops back to the beginning
      if (loopCount !== lastLoopCountRef.current) {
        lastLoopCountRef.current = loopCount
        smoothedValues.current = { ...IDLE_VALUES }
      }

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

      // Update each value with exponential smoothing
      const state = smoothedValues.current
      const keys = Object.keys(SMOOTH_CONFIGS) as (keyof AudioReactiveValues)[]

      for (const key of keys) {
        state[key] = smoothValue(state[key], targets[key], SMOOTH_CONFIGS[key])
      }

      // Return a copy of the current state
      return {
        sphereStrength: state.sphereStrength,
        sphereTimeFrequency: state.sphereTimeFrequency,
        ringSpeedMultiplier: state.ringSpeedMultiplier,
        ringScaleMultiplier: state.ringScaleMultiplier,
        particleRotationSpeed: state.particleRotationSpeed,
      }
    },
    [isPlaying, getAudioData, loopCount],
  )

  return { update, isPlaying }
}
