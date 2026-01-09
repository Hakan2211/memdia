/**
 * Insights Types
 * Types for extracted insights from reflection sessions
 */

// ==========================================
// Mood Types
// ==========================================

// 20 mood options organized by valence
export const POSITIVE_MOODS = [
  'joyful',
  'grateful',
  'hopeful',
  'excited',
  'peaceful',
  'content',
  'proud',
  'loved',
] as const

export const NEUTRAL_MOODS = [
  'calm',
  'reflective',
  'curious',
  'contemplative',
  'uncertain',
  'nostalgic',
] as const

export const NEGATIVE_MOODS = [
  'anxious',
  'frustrated',
  'overwhelmed',
  'sad',
  'worried',
  'angry',
  'lonely',
  'exhausted',
] as const

export const ALL_MOODS = [
  ...POSITIVE_MOODS,
  ...NEUTRAL_MOODS,
  ...NEGATIVE_MOODS,
] as const

export type Mood = (typeof ALL_MOODS)[number]

export type MoodValence = 'positive' | 'neutral' | 'negative'

export function getMoodValence(mood: Mood): MoodValence {
  if ((POSITIVE_MOODS as ReadonlyArray<string>).includes(mood)) return 'positive'
  if ((NEUTRAL_MOODS as ReadonlyArray<string>).includes(mood)) return 'neutral'
  return 'negative'
}

// Mood with metadata
export interface ReflectionMood {
  id: string
  sessionId: string
  mood: Mood
  confidence: number
  createdAt: Date
}

// ==========================================
// Insight Category Types
// ==========================================

export const INSIGHT_CATEGORIES = [
  'realization',
  'goal',
  'gratitude',
  'concern',
  'question',
  'learning',
  'idea',
  'inspiration',
] as const

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number]

export interface ReflectionInsight {
  id: string
  sessionId: string
  text: string
  category: InsightCategory
  createdAt: Date
}

// Category metadata for UI
export const INSIGHT_CATEGORY_META: Record<
  InsightCategory,
  { label: string; icon: string; color: string }
> = {
  realization: {
    label: 'Realization',
    icon: 'lightbulb',
    color: 'text-amber-500',
  },
  goal: { label: 'Goal', icon: 'target', color: 'text-blue-500' },
  gratitude: { label: 'Gratitude', icon: 'heart', color: 'text-pink-500' },
  concern: {
    label: 'Concern',
    icon: 'alert-triangle',
    color: 'text-orange-500',
  },
  question: {
    label: 'Question',
    icon: 'help-circle',
    color: 'text-purple-500',
  },
  learning: { label: 'Learning', icon: 'book-open', color: 'text-green-500' },
  idea: { label: 'Idea', icon: 'sparkles', color: 'text-cyan-500' },
  inspiration: { label: 'Inspiration', icon: 'star', color: 'text-yellow-500' },
}

// ==========================================
// Topic Types
// ==========================================

export interface ReflectionTopic {
  id: string
  sessionId: string
  topic: string
  createdAt: Date
}

// Aggregated topic with count
export interface TopicWithCount {
  topic: string
  count: number
  sessions: Array<string> // session IDs
}

// ==========================================
// Todo Types
// ==========================================

export const TODO_PRIORITIES = ['high', 'medium', 'low'] as const
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

export interface Todo {
  id: string
  userId: string
  text: string
  dueDate: Date | null
  priority: TodoPriority | null
  context: string | null
  completed: boolean
  completedAt: Date | null
  sourceSessionId: string | null
  createdAt: Date
  updatedAt: Date
}

// For creating a new todo
export interface CreateTodoInput {
  text: string
  dueDate?: Date | null
  priority?: TodoPriority | null
  context?: string | null
  sourceSessionId?: string | null
}

// For updating a todo
export interface UpdateTodoInput {
  id: string
  text?: string
  dueDate?: Date | null
  priority?: TodoPriority | null
  context?: string | null
  completed?: boolean
}

// ==========================================
// Person/People Types
// ==========================================

export const RELATIONSHIP_TYPES = [
  'friend',
  'family',
  'coworker',
  'partner',
  'acquaintance',
  'other',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export const SENTIMENT_TYPES = ['positive', 'neutral', 'negative'] as const
export type Sentiment = (typeof SENTIMENT_TYPES)[number]

export interface Person {
  id: string
  userId: string
  name: string
  relationship: RelationshipType | null
  mentionCount: number
  averageSentiment: number | null // -1 to 1
  lastMentioned: Date
  createdAt: Date
  updatedAt: Date
}

export interface PersonMention {
  id: string
  personId: string
  sessionId: string
  sentiment: Sentiment | null
  context: string | null
  createdAt: Date
}

// Person with mentions for detail view
export interface PersonWithMentions extends Person {
  mentions: Array<PersonMention & {
    session: {
      id: string
      date: Date
      summaryText: string | null
    }
  }>
}

// ==========================================
// AI Extraction Types
// ==========================================

// Structure returned by AI extraction
export interface ExtractedInsights {
  mood: {
    primary: Mood
    confidence: number
  }
  topics: Array<string>
  insights: Array<{
    text: string
    category: InsightCategory
  }>
  todos: Array<{
    text: string
    dueDate: string | null // ISO date string
    priority: TodoPriority | null
    context: string | null
  }>
  people: Array<{
    name: string
    relationship: RelationshipType | null
    sentiment: Sentiment
  }>
}

// ==========================================
// Overview/Stats Types
// ==========================================

export interface InsightsOverview {
  // Counts
  totalReflections: number
  pendingTodos: number
  completedTodos: number
  trackedPeople: number

  // Recent mood
  recentMood: Mood | null
  moodTrend: 'improving' | 'stable' | 'declining' | null

  // Top topics this week
  topTopics: Array<TopicWithCount>

  // Recent insights
  recentInsights: Array<ReflectionInsight>
}

// Mood history for charts
export interface MoodHistoryEntry {
  date: Date
  mood: Mood
  sessionId: string
}

// Mood distribution for charts
export interface MoodDistribution {
  mood: Mood
  count: number
  percentage: number
}
