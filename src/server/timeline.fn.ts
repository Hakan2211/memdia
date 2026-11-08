/**
 * Timeline Server Functions
 * Merged per-day view of memory + reflection images/summaries for a date range
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { endOfDay, format, parseISO, startOfDay } from 'date-fns'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import type { Mood } from '../types/insights'

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rangeSchema = z.object({ start: dateKeySchema, end: dateKeySchema })

// Guard against absurd ranges (month view needs at most 6 weeks)
const MAX_RANGE_DAYS = 62

export interface TimelineMemory {
  id: string
  imageUrl: string | null
  summaryText: string | null
}

export interface TimelineReflection {
  id: string
  imageUrl: string | null
  imageStatus: string
  summaryText: string | null
  mood: Mood | null
}

export interface TimelineDay {
  memory?: TimelineMemory
  reflection?: TimelineReflection
}

export type TimelineData = Record<string, TimelineDay>

/**
 * Earliest completed entry (memory or reflection) as yyyy-MM-dd, or null.
 * Lets the infinite week feed know when to stop loading older weeks.
 */
export const getTimelineStartFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string | null> => {
    const where = { userId: context.user.id, status: 'completed' }
    const [memory, reflection] = await Promise.all([
      prisma.voiceSession.findFirst({
        where,
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      prisma.reflectionSession.findFirst({
        where,
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
    ])
    const dates = [memory?.date, reflection?.date].filter((d): d is Date => !!d)
    if (dates.length === 0) return null
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
    return format(earliest, 'yyyy-MM-dd')
  })

export const getTimelineFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(rangeSchema)
  .handler(async ({ data, context }): Promise<TimelineData> => {
    // Date-only strings parse as local midnight, matching how sessions are stored
    const startDate = startOfDay(parseISO(data.start))
    const endDate = endOfDay(parseISO(data.end))

    const spanDays = (endDate.getTime() - startDate.getTime()) / 86_400_000
    if (spanDays < 0 || spanDays > MAX_RANGE_DAYS) {
      throw new Error('Invalid timeline range')
    }

    const where = {
      userId: context.user.id,
      status: 'completed',
      date: { gte: startDate, lte: endDate },
    }

    const [memories, reflections] = await Promise.all([
      prisma.voiceSession.findMany({
        where,
        select: { id: true, date: true, imageUrl: true, summaryText: true },
      }),
      prisma.reflectionSession.findMany({
        where,
        select: {
          id: true,
          date: true,
          imageUrl: true,
          imageStatus: true,
          summaryText: true,
          mood: { select: { mood: true } },
        },
      }),
    ])

    const days: TimelineData = {}

    for (const m of memories) {
      const key = format(m.date, 'yyyy-MM-dd')
      days[key] = {
        ...days[key],
        memory: { id: m.id, imageUrl: m.imageUrl, summaryText: m.summaryText },
      }
    }

    for (const r of reflections) {
      const key = format(r.date, 'yyyy-MM-dd')
      days[key] = {
        ...days[key],
        reflection: {
          id: r.id,
          imageUrl: r.imageUrl,
          imageStatus: r.imageStatus,
          summaryText: r.summaryText,
          mood: (r.mood?.mood as Mood | undefined) ?? null,
        },
      }
    }

    return days
  })
