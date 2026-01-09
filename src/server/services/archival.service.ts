/**
 * Archival Service
 * Handles background upload of session audio to Bunny.net CDN
 *
 * This service runs after a session ends to permanently store:
 * - User audio recordings
 * - AI response audio (regenerated if needed)
 *
 * Audio URLs in the database are updated once archival completes.
 */

import { prisma } from '../../db'
import { uploadAudio, uploadManifest } from './bunny.service'
import { generateSpeech } from './falai.service'
import type { AudioManifest } from '../../types/voice-session'

// ==========================================
// Types
// ==========================================

export interface ArchivalResult {
  sessionId: string
  success: boolean
  turnsArchived: number
  errors: Array<string>
  duration: number
}

// TurnToArchive interface kept for documentation - matches Prisma TranscriptTurn shape
// interface TurnToArchive {
//   id: string
//   order: number
//   speaker: 'user' | 'ai'
//   text: string
//   startTime: number
//   duration: number
//   audioUrl: string | null
// }

// ==========================================
// Main Archival Function
// ==========================================

/**
 * Archive a completed session's audio to Bunny.net CDN
 *
 * This function:
 * 1. Fetches all turns for the session
 * 2. For each turn without a permanent audio URL:
 *    - User turns: Should already have audio uploaded during conversation
 *    - AI turns: Regenerate TTS and upload
 * 3. Creates an audio manifest for replay
 * 4. Updates database with permanent URLs
 *
 * @param sessionId - The voice session ID to archive
 * @returns Archival result with success status and any errors
 */
export async function archiveSession(
  sessionId: string,
): Promise<ArchivalResult> {
  const startTime = Date.now()
  const errors: Array<string> = []
  let turnsArchived = 0

  console.log(`[Archival] Starting archival for session: ${sessionId}`)

  try {
    // Get session with turns
    const session = await prisma.voiceSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!session) {
      return {
        sessionId,
        success: false,
        turnsArchived: 0,
        errors: ['Session not found'],
        duration: Date.now() - startTime,
      }
    }

    const manifest: AudioManifest = {
      sessionId,
      totalDuration: 0,
      turns: [],
    }

    // Process each turn
    for (const turn of session.turns) {
      try {
        let audioUrl = turn.audioUrl

        // Check if audio URL is a temporary fal.ai URL or missing
        const needsArchival =
          !audioUrl ||
          audioUrl.includes('fal.media') ||
          audioUrl.includes('v3.fal.media')

        if (needsArchival) {
          if (turn.speaker === 'ai') {
            // Regenerate AI audio
            console.log(
              `[Archival] Regenerating AI audio for turn ${turn.order}`,
            )
            const ttsResult = await generateSpeech(turn.text)

            if (ttsResult.audioUrl) {
              // Fetch the audio
              const response = await fetch(ttsResult.audioUrl)
              if (response.ok) {
                const buffer = await response.arrayBuffer()

                // Upload to Bunny.net
                const uploadResult = await uploadAudio(
                  session.userId,
                  sessionId,
                  turn.order,
                  'ai',
                  buffer,
                  ttsResult.contentType,
                )

                audioUrl = uploadResult.url
                turnsArchived++

                console.log(
                  `[Archival] Uploaded AI turn ${turn.order}: ${audioUrl}`,
                )
              }
            }
          } else if (turn.speaker === 'user' && turn.audioUrl) {
            // User audio exists but is temporary - re-upload
            // This shouldn't happen often as user audio is uploaded during conversation
            console.log(
              `[Archival] Re-uploading user audio for turn ${turn.order}`,
            )

            try {
              const response = await fetch(turn.audioUrl)
              if (response.ok) {
                const buffer = await response.arrayBuffer()
                const contentType =
                  response.headers.get('content-type') || 'audio/wav'

                const uploadResult = await uploadAudio(
                  session.userId,
                  sessionId,
                  turn.order,
                  'user',
                  buffer,
                  contentType,
                )

                audioUrl = uploadResult.url
                turnsArchived++
              }
            } catch (fetchError) {
              console.error(
                `[Archival] Failed to fetch user audio for turn ${turn.order}:`,
                fetchError,
              )
              errors.push(`Failed to archive user turn ${turn.order}`)
            }
          }

          // Update database with permanent URL
          if (audioUrl && audioUrl !== turn.audioUrl) {
            await prisma.transcriptTurn.update({
              where: { id: turn.id },
              data: { audioUrl },
            })
          }
        }

        // Add to manifest
        if (audioUrl) {
          manifest.turns.push({
            order: turn.order,
            speaker: turn.speaker as 'user' | 'ai',
            audioUrl,
            startTime: turn.startTime,
            duration: turn.duration,
          })
          manifest.totalDuration = Math.max(
            manifest.totalDuration,
            turn.startTime + turn.duration,
          )
        }
      } catch (turnError) {
        console.error(
          `[Archival] Error processing turn ${turn.order}:`,
          turnError,
        )
        errors.push(`Failed to process turn ${turn.order}`)
      }
    }

    // Upload manifest
    if (manifest.turns.length > 0) {
      try {
        await uploadManifest(session.userId, sessionId, manifest)
        console.log(`[Archival] Uploaded manifest for session ${sessionId}`)
      } catch (manifestError) {
        console.error('[Archival] Failed to upload manifest:', manifestError)
        errors.push('Failed to upload manifest')
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `[Archival] Completed for session ${sessionId} in ${duration}ms (${turnsArchived} turns archived)`,
    )

    return {
      sessionId,
      success: errors.length === 0,
      turnsArchived,
      errors,
      duration,
    }
  } catch (error) {
    console.error(`[Archival] Fatal error for session ${sessionId}:`, error)
    return {
      sessionId,
      success: false,
      turnsArchived,
      errors: [
        ...errors,
        error instanceof Error ? error.message : 'Unknown error',
      ],
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Archive multiple sessions (batch processing)
 * Useful for catching up on any sessions that weren't archived
 */
export async function archiveSessionsBatch(
  sessionIds: Array<string>,
): Promise<Array<ArchivalResult>> {
  const results: Array<ArchivalResult> = []

  for (const sessionId of sessionIds) {
    const result = await archiveSession(sessionId)
    results.push(result)

    // Small delay between sessions to avoid rate limiting
    await sleep(500)
  }

  return results
}

/**
 * Find sessions that need archival
 * Returns sessions that are completed but have turns with temporary URLs
 */
export async function findSessionsNeedingArchival(
  limit: number = 10,
): Promise<Array<string>> {
  const sessions = await prisma.voiceSession.findMany({
    where: {
      status: 'completed',
      turns: {
        some: {
          OR: [
            { audioUrl: null },
            { audioUrl: { contains: 'fal.media' } },
            { audioUrl: { contains: 'v3.fal.media' } },
          ],
        },
      },
    },
    select: { id: true },
    take: limit,
    orderBy: { completedAt: 'desc' },
  })

  return sessions.map((s) => s.id)
}

// ==========================================
// Helpers
// ==========================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
