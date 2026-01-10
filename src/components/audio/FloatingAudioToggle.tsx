'use client'

import { AudioToggle } from './AudioToggle'

export function FloatingAudioToggle() {
  return (
    <div className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-sm rounded-lg p-2">
      <AudioToggle variant="dark" />
    </div>
  )
}
