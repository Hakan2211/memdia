/**
 * Insights Server Functions
 * API functions for the insights page - todos, people, moods, topics, insights
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import type {
  Mood,
  InsightCategory,
  TodoPriority,
  Sentiment,
} from '../types/insights'

// ==========================================
// Schemas
// ==========================================

const createTodoSchema = z.object({
  text: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
  context: z.string().nullable().optional(),
})

const updateTodoSchema = z.object({
  id: z.string(),
  text: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
  context: z.string().nullable().optional(),
  completed: z.boolean().optional(),
})

const todoIdSchema = z.object({ id: z.string() })
const personIdSchema = z.object({ id: z.string() })
const topicSchema = z.object({ topic: z.string() })

// ==========================================
// Overview
// ==========================================

export const getInsightsOverviewFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    // Get counts in parallel
    const [
      totalReflections,
      pendingTodos,
      completedTodos,
      trackedPeople,
      recentMood,
      topTopics,
      recentInsights,
    ] = await Promise.all([
      // Total reflections
      prisma.reflectionSession.count({
        where: { userId, status: 'completed' },
      }),

      // Pending todos
      prisma.todo.count({
        where: { userId, completed: false },
      }),

      // Completed todos
      prisma.todo.count({
        where: { userId, completed: true },
      }),

      // Tracked people
      prisma.person.count({
        where: { userId },
      }),

      // Most recent mood
      prisma.reflectionMood.findFirst({
        where: {
          session: { userId },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          session: {
            select: { date: true },
          },
        },
      }),

      // Top topics (last 30 days)
      prisma.reflectionTopic.groupBy({
        by: ['topic'],
        where: {
          session: {
            userId,
            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        _count: { topic: true },
        orderBy: { _count: { topic: 'desc' } },
        take: 5,
      }),

      // Recent insights
      prisma.reflectionInsight.findMany({
        where: {
          session: { userId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          session: {
            select: { date: true },
          },
        },
      }),
    ])

    return {
      totalReflections,
      pendingTodos,
      completedTodos,
      trackedPeople,
      recentMood: recentMood
        ? {
            mood: recentMood.mood as Mood,
            date: recentMood.session.date,
          }
        : null,
      topTopics: topTopics.map((t) => ({
        topic: t.topic,
        count: t._count.topic,
      })),
      recentInsights: recentInsights.map((i) => ({
        id: i.id,
        text: i.text,
        category: i.category as InsightCategory,
        date: i.session.date,
      })),
    }
  })

// ==========================================
// Todos
// ==========================================

export const getTodosFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
    })

    return todos.map((t) => ({
      ...t,
      priority: t.priority as TodoPriority | null,
    }))
  })

export const createTodoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createTodoSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    const todo = await prisma.todo.create({
      data: {
        userId,
        text: data.text,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || null,
        context: data.context || null,
      },
    })

    return todo
  })

export const updateTodoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateTodoSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    // Verify ownership
    const existing = await prisma.todo.findFirst({
      where: { id: data.id, userId },
    })

    if (!existing) {
      throw new Error('Todo not found')
    }

    const todo = await prisma.todo.update({
      where: { id: data.id },
      data: {
        text: data.text,
        dueDate:
          data.dueDate !== undefined
            ? data.dueDate
              ? new Date(data.dueDate)
              : null
            : undefined,
        priority: data.priority !== undefined ? data.priority : undefined,
        context: data.context !== undefined ? data.context : undefined,
        completed: data.completed !== undefined ? data.completed : undefined,
        completedAt:
          data.completed === true
            ? new Date()
            : data.completed === false
              ? null
              : undefined,
      },
    })

    return todo
  })

export const deleteTodoFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(todoIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    // Verify ownership
    const existing = await prisma.todo.findFirst({
      where: { id: data.id, userId },
    })

    if (!existing) {
      throw new Error('Todo not found')
    }

    await prisma.todo.delete({
      where: { id: data.id },
    })

    return { success: true }
  })

// ==========================================
// People
// ==========================================

export const getPeopleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const people = await prisma.person.findMany({
      where: { userId },
      orderBy: [{ mentionCount: 'desc' }, { lastMentioned: 'desc' }],
    })

    return people
  })

export const getPersonDetailFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(personIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    const person = await prisma.person.findFirst({
      where: { id: data.id, userId },
      include: {
        mentions: {
          include: {
            session: {
              select: {
                id: true,
                date: true,
                summaryText: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!person) {
      throw new Error('Person not found')
    }

    return {
      ...person,
      mentions: person.mentions.map((m) => ({
        id: m.id,
        sentiment: m.sentiment as Sentiment | null,
        context: m.context,
        date: m.session.date,
        sessionId: m.session.id,
        summaryPreview: m.session.summaryText?.slice(0, 100),
      })),
    }
  })

// ==========================================
// Moods
// ==========================================

export const getMoodHistoryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    // Get mood history for last 30 days
    const moods = await prisma.reflectionMood.findMany({
      where: {
        session: {
          userId,
          date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      include: {
        session: {
          select: { id: true, date: true },
        },
      },
      orderBy: { session: { date: 'desc' } },
    })

    return moods.map((m) => ({
      id: m.id,
      mood: m.mood as Mood,
      confidence: m.confidence,
      date: m.session.date,
      sessionId: m.session.id,
    }))
  })

export const getMoodDistributionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const distribution = await prisma.reflectionMood.groupBy({
      by: ['mood'],
      where: {
        session: { userId },
      },
      _count: { mood: true },
      orderBy: { _count: { mood: 'desc' } },
    })

    const total = distribution.reduce((sum, d) => sum + d._count.mood, 0)

    return distribution.map((d) => ({
      mood: d.mood as Mood,
      count: d._count.mood,
      percentage: total > 0 ? (d._count.mood / total) * 100 : 0,
    }))
  })

// ==========================================
// Topics
// ==========================================

export const getTopicsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const topics = await prisma.reflectionTopic.groupBy({
      by: ['topic'],
      where: {
        session: { userId },
      },
      _count: { topic: true },
      orderBy: { _count: { topic: 'desc' } },
    })

    return topics.map((t) => ({
      topic: t.topic,
      count: t._count.topic,
    }))
  })

export const getSessionsByTopicFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(topicSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    const sessions = await prisma.reflectionSession.findMany({
      where: {
        userId,
        status: 'completed',
        topics: {
          some: { topic: data.topic },
        },
      },
      select: {
        id: true,
        date: true,
        summaryText: true,
        mood: true,
        topics: true,
      },
      orderBy: { date: 'desc' },
      take: 20,
    })

    return sessions.map((s) => ({
      id: s.id,
      date: s.date,
      summaryPreview: s.summaryText?.slice(0, 150),
      mood: s.mood?.mood as Mood | undefined,
      topics: s.topics.map((t) => t.topic),
    }))
  })

// ==========================================
// Insights (Categorized)
// ==========================================

export const getInsightsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const insights = await prisma.reflectionInsight.findMany({
      where: {
        session: { userId },
      },
      include: {
        session: {
          select: { id: true, date: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return insights.map((i) => ({
      id: i.id,
      text: i.text,
      category: i.category as InsightCategory,
      date: i.session.date,
      sessionId: i.session.id,
    }))
  })

export const getInsightsByCategoryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const insights = await prisma.reflectionInsight.findMany({
      where: {
        session: { userId },
      },
      include: {
        session: {
          select: { date: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Group by category
    const byCategory: Record<
      InsightCategory,
      Array<{ id: string; text: string; date: Date }>
    > = {
      realization: [],
      goal: [],
      gratitude: [],
      concern: [],
      question: [],
      learning: [],
      idea: [],
      inspiration: [],
    }

    for (const insight of insights) {
      const category = insight.category as InsightCategory
      if (byCategory[category]) {
        byCategory[category].push({
          id: insight.id,
          text: insight.text,
          date: insight.session.date,
        })
      }
    }

    return byCategory
  })

// ==========================================
// Timeline
// ==========================================

export const getReflectionTimelineFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id

    const sessions = await prisma.reflectionSession.findMany({
      where: {
        userId,
        status: 'completed',
      },
      select: {
        id: true,
        date: true,
        summaryText: true,
        mood: true,
        topics: true,
      },
      orderBy: { date: 'desc' },
      take: 30,
    })

    return sessions.map((s) => ({
      id: s.id,
      date: s.date,
      summaryPreview: s.summaryText?.slice(0, 100),
      mood: (s.mood?.mood as Mood) || null,
      topics: s.topics.map((t) => t.topic),
    }))
  })
