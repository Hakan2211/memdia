/**
 * Mock Data for Insights Visual Testing
 * Usage: Visit /insights?mock=true to see mock data
 *
 * DELETE THIS FILE after visual testing is complete
 */

import type {
  Mood,
  InsightCategory,
  TodoPriority,
  RelationshipType,
  Sentiment,
} from '../../types/insights'

// ==========================================
// Helper to generate dates
// ==========================================

function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(0, 0, 0, 0)
  return date
}

// ==========================================
// Mock Todos (7 items - 4 pending, 3 completed)
// ==========================================

export const MOCK_TODOS = [
  // Pending - high priority with due date
  {
    id: 'mock-todo-1',
    userId: 'mock-user',
    text: 'Call mom this weekend',
    dueDate: daysFromNow(3),
    priority: 'high' as TodoPriority,
    context: 'Mentioned wanting to reconnect with family after feeling distant',
    completed: false,
    completedAt: null,
    sourceSessionId: 'mock-session-1',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  // Pending - medium priority with due date
  {
    id: 'mock-todo-2',
    userId: 'mock-user',
    text: 'Start morning meditation routine',
    dueDate: daysFromNow(1),
    priority: 'medium' as TodoPriority,
    context: 'Part of the self-care goals discussed',
    completed: false,
    completedAt: null,
    sourceSessionId: 'mock-session-2',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  // Pending - low priority, no due date
  {
    id: 'mock-todo-3',
    userId: 'mock-user',
    text: 'Research meditation apps and pick one',
    dueDate: null,
    priority: 'low' as TodoPriority,
    context: null,
    completed: false,
    completedAt: null,
    sourceSessionId: 'mock-session-2',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  // Pending - no priority, no due date
  {
    id: 'mock-todo-4',
    userId: 'mock-user',
    text: 'Write down three things I am grateful for each morning',
    dueDate: null,
    priority: null,
    context: 'Gratitude practice idea from reflection',
    completed: false,
    completedAt: null,
    sourceSessionId: 'mock-session-4',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  },
  // Completed
  {
    id: 'mock-todo-5',
    userId: 'mock-user',
    text: 'Reply to Sarah about weekend plans',
    dueDate: daysAgo(1),
    priority: 'high' as TodoPriority,
    context: null,
    completed: true,
    completedAt: daysAgo(1),
    sourceSessionId: 'mock-session-1',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  // Completed
  {
    id: 'mock-todo-6',
    userId: 'mock-user',
    text: 'Schedule dentist appointment',
    dueDate: null,
    priority: 'medium' as TodoPriority,
    context: null,
    completed: true,
    completedAt: daysAgo(4),
    sourceSessionId: null, // Manual todo
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
  },
  // Completed
  {
    id: 'mock-todo-7',
    userId: 'mock-user',
    text: 'Set up automatic bill payments',
    dueDate: null,
    priority: 'low' as TodoPriority,
    context: 'Financial organization goal',
    completed: true,
    completedAt: daysAgo(6),
    sourceSessionId: 'mock-session-5',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(6),
  },
]

// ==========================================
// Mock People (8 people with variety)
// ==========================================

export const MOCK_PEOPLE = [
  {
    id: 'mock-person-1',
    userId: 'mock-user',
    name: 'Sarah',
    relationship: 'friend' as RelationshipType,
    mentionCount: 12,
    averageSentiment: 0.8,
    lastMentioned: daysAgo(1),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
  },
  {
    id: 'mock-person-2',
    userId: 'mock-user',
    name: 'Mom',
    relationship: 'family' as RelationshipType,
    mentionCount: 8,
    averageSentiment: 0.9,
    lastMentioned: daysAgo(2),
    createdAt: daysAgo(28),
    updatedAt: daysAgo(2),
  },
  {
    id: 'mock-person-3',
    userId: 'mock-user',
    name: 'Alex',
    relationship: 'partner' as RelationshipType,
    mentionCount: 15,
    averageSentiment: 0.75,
    lastMentioned: daysAgo(0),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(0),
  },
  {
    id: 'mock-person-4',
    userId: 'mock-user',
    name: 'My boss',
    relationship: 'coworker' as RelationshipType,
    mentionCount: 6,
    averageSentiment: -0.5,
    lastMentioned: daysAgo(3),
    createdAt: daysAgo(25),
    updatedAt: daysAgo(3),
  },
  {
    id: 'mock-person-5',
    userId: 'mock-user',
    name: 'David',
    relationship: 'coworker' as RelationshipType,
    mentionCount: 4,
    averageSentiment: 0.3,
    lastMentioned: daysAgo(5),
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  },
  {
    id: 'mock-person-6',
    userId: 'mock-user',
    name: 'Dr. Martinez',
    relationship: 'other' as RelationshipType,
    mentionCount: 2,
    averageSentiment: 0.4,
    lastMentioned: daysAgo(10),
    createdAt: daysAgo(15),
    updatedAt: daysAgo(10),
  },
  {
    id: 'mock-person-7',
    userId: 'mock-user',
    name: 'Jamie',
    relationship: 'acquaintance' as RelationshipType,
    mentionCount: 1,
    averageSentiment: 0.0,
    lastMentioned: daysAgo(14),
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14),
  },
  {
    id: 'mock-person-8',
    userId: 'mock-user',
    name: 'Dad',
    relationship: 'family' as RelationshipType,
    mentionCount: 5,
    averageSentiment: 0.6,
    lastMentioned: daysAgo(7),
    createdAt: daysAgo(28),
    updatedAt: daysAgo(7),
  },
]

// Mock person mentions for detail view
export const MOCK_PERSON_MENTIONS: Record<
  string,
  Array<{
    id: string
    sentiment: Sentiment | null
    context: string | null
    date: Date
    sessionId: string
    summaryPreview: string
  }>
> = {
  'mock-person-1': [
    // Sarah
    {
      id: 'mock-mention-1',
      sentiment: 'positive',
      context: null,
      date: daysAgo(1),
      sessionId: 'mock-session-1',
      summaryPreview:
        'Talked about weekend plans with Sarah and how grateful I am for our friendship...',
    },
    {
      id: 'mock-mention-2',
      sentiment: 'positive',
      context: null,
      date: daysAgo(5),
      sessionId: 'mock-session-3',
      summaryPreview:
        'Sarah gave me great advice about the work situation. Feeling supported...',
    },
    {
      id: 'mock-mention-3',
      sentiment: 'neutral',
      context: null,
      date: daysAgo(12),
      sessionId: 'mock-session-6',
      summaryPreview:
        'Mentioned needing to catch up with Sarah soon, been too busy lately...',
    },
  ],
  'mock-person-2': [
    // Mom
    {
      id: 'mock-mention-4',
      sentiment: 'positive',
      context: null,
      date: daysAgo(2),
      sessionId: 'mock-session-2',
      summaryPreview:
        "Feeling grateful for Mom's unconditional support during this challenging time...",
    },
    {
      id: 'mock-mention-5',
      sentiment: 'positive',
      context: null,
      date: daysAgo(9),
      sessionId: 'mock-session-5',
      summaryPreview:
        'Had a wonderful call with Mom. She always knows what to say...',
    },
  ],
  'mock-person-3': [
    // Alex
    {
      id: 'mock-mention-6',
      sentiment: 'positive',
      context: null,
      date: daysAgo(0),
      sessionId: 'mock-session-0',
      summaryPreview:
        'Alex and I had a meaningful conversation about our future together...',
    },
    {
      id: 'mock-mention-7',
      sentiment: 'neutral',
      context: null,
      date: daysAgo(4),
      sessionId: 'mock-session-3',
      summaryPreview:
        'Need to plan something special for Alex. Want to show more appreciation...',
    },
    {
      id: 'mock-mention-8',
      sentiment: 'positive',
      context: null,
      date: daysAgo(8),
      sessionId: 'mock-session-4',
      summaryPreview:
        'Grateful for how patient Alex has been with my work stress...',
    },
  ],
  'mock-person-4': [
    // My boss
    {
      id: 'mock-mention-9',
      sentiment: 'negative',
      context: null,
      date: daysAgo(3),
      sessionId: 'mock-session-2',
      summaryPreview:
        'Frustrated with the micromanagement. Need to set better boundaries at work...',
    },
    {
      id: 'mock-mention-10',
      sentiment: 'negative',
      context: null,
      date: daysAgo(10),
      sessionId: 'mock-session-6',
      summaryPreview:
        'Another difficult meeting. Questioning if this job is right for me...',
    },
  ],
  'mock-person-5': [
    // David
    {
      id: 'mock-mention-11',
      sentiment: 'positive',
      context: null,
      date: daysAgo(5),
      sessionId: 'mock-session-3',
      summaryPreview:
        'David offered to help with the project. Nice to have allies at work...',
    },
  ],
  'mock-person-6': [
    // Dr. Martinez
    {
      id: 'mock-mention-12',
      sentiment: 'positive',
      context: null,
      date: daysAgo(10),
      sessionId: 'mock-session-6',
      summaryPreview:
        'Good session with Dr. Martinez. Making progress on anxiety management...',
    },
  ],
  'mock-person-7': [
    // Jamie
    {
      id: 'mock-mention-13',
      sentiment: 'neutral',
      context: null,
      date: daysAgo(14),
      sessionId: 'mock-session-8',
      summaryPreview:
        'Ran into Jamie at the coffee shop. Brief but pleasant conversation...',
    },
  ],
  'mock-person-8': [
    // Dad
    {
      id: 'mock-mention-14',
      sentiment: 'positive',
      context: null,
      date: daysAgo(7),
      sessionId: 'mock-session-4',
      summaryPreview:
        'Dad shared some wisdom about career decisions. His experience is invaluable...',
    },
    {
      id: 'mock-mention-15',
      sentiment: 'neutral',
      context: null,
      date: daysAgo(15),
      sessionId: 'mock-session-9',
      summaryPreview: "Thinking about visiting Dad soon. It's been too long...",
    },
  ],
}

// ==========================================
// Mock Mood History (20 entries - all moods)
// ==========================================

const ALL_MOODS: Mood[] = [
  'joyful',
  'grateful',
  'hopeful',
  'excited',
  'peaceful',
  'content',
  'proud',
  'loved',
  'calm',
  'reflective',
  'curious',
  'contemplative',
  'uncertain',
  'nostalgic',
  'anxious',
  'frustrated',
  'overwhelmed',
  'sad',
  'worried',
  'angry',
  'lonely',
  'exhausted',
]

export const MOCK_MOOD_HISTORY = ALL_MOODS.map((mood, index) => ({
  id: `mock-mood-${index}`,
  mood,
  confidence: 0.7 + Math.random() * 0.25,
  date: daysAgo(index),
  sessionId: `mock-session-${index}`,
}))

// Mood distribution (aggregated counts)
export const MOCK_MOOD_DISTRIBUTION = [
  { mood: 'peaceful' as Mood, count: 5, percentage: 22.7 },
  { mood: 'grateful' as Mood, count: 4, percentage: 18.2 },
  { mood: 'reflective' as Mood, count: 3, percentage: 13.6 },
  { mood: 'anxious' as Mood, count: 2, percentage: 9.1 },
  { mood: 'hopeful' as Mood, count: 2, percentage: 9.1 },
  { mood: 'content' as Mood, count: 2, percentage: 9.1 },
  { mood: 'calm' as Mood, count: 1, percentage: 4.5 },
  { mood: 'curious' as Mood, count: 1, percentage: 4.5 },
  { mood: 'frustrated' as Mood, count: 1, percentage: 4.5 },
  { mood: 'overwhelmed' as Mood, count: 1, percentage: 4.5 },
]

// ==========================================
// Mock Topics (15 topics)
// ==========================================

export const MOCK_TOPICS = [
  { topic: 'work', count: 12 },
  { topic: 'relationships', count: 10 },
  { topic: 'family', count: 8 },
  { topic: 'health', count: 7 },
  { topic: 'personal growth', count: 6 },
  { topic: 'stress', count: 5 },
  { topic: 'goals', count: 5 },
  { topic: 'self-care', count: 4 },
  { topic: 'gratitude', count: 4 },
  { topic: 'boundaries', count: 3 },
  { topic: 'finances', count: 3 },
  { topic: 'creativity', count: 2 },
  { topic: 'spirituality', count: 2 },
  { topic: 'change', count: 2 },
  { topic: 'future', count: 1 },
]

// Sessions by topic (for modal)
export const MOCK_SESSIONS_BY_TOPIC: Record<
  string,
  Array<{
    id: string
    date: Date
    summaryPreview: string
    mood: Mood
    topics: string[]
  }>
> = {
  work: [
    {
      id: 'mock-session-topic-1',
      date: daysAgo(1),
      summaryPreview:
        'Reflected on the challenging project deadline and strategies for managing workload...',
      mood: 'anxious',
      topics: ['work', 'stress', 'boundaries'],
    },
    {
      id: 'mock-session-topic-2',
      date: daysAgo(5),
      summaryPreview:
        'Had a breakthrough with the presentation. Feeling more confident about the direction...',
      mood: 'hopeful',
      topics: ['work', 'personal growth'],
    },
    {
      id: 'mock-session-topic-3',
      date: daysAgo(10),
      summaryPreview:
        'Frustrating day with constant interruptions. Need to protect my focus time better...',
      mood: 'frustrated',
      topics: ['work', 'boundaries'],
    },
  ],
  relationships: [
    {
      id: 'mock-session-topic-4',
      date: daysAgo(2),
      summaryPreview:
        'Grateful for the support system I have. Friends and family make such a difference...',
      mood: 'grateful',
      topics: ['relationships', 'gratitude', 'family'],
    },
    {
      id: 'mock-session-topic-5',
      date: daysAgo(8),
      summaryPreview:
        'Thinking about how to nurture my relationships better. Quality time matters...',
      mood: 'reflective',
      topics: ['relationships', 'goals'],
    },
  ],
  family: [
    {
      id: 'mock-session-topic-6',
      date: daysAgo(3),
      summaryPreview:
        "Mom's advice really helped put things in perspective. Family wisdom is invaluable...",
      mood: 'peaceful',
      topics: ['family', 'gratitude'],
    },
  ],
}

// ==========================================
// Mock Insights (3 per category = 24 total)
// ==========================================

export const MOCK_INSIGHTS_BY_CATEGORY: Record<
  InsightCategory,
  Array<{
    id: string
    text: string
    date: Date
  }>
> = {
  realization: [
    {
      id: 'mock-insight-1',
      text: 'I realized that my need for control comes from fear of uncertainty, not actual danger.',
      date: daysAgo(1),
    },
    {
      id: 'mock-insight-2',
      text: 'My perfectionism is actually holding me back more than helping me succeed.',
      date: daysAgo(5),
    },
    {
      id: 'mock-insight-3',
      text: "I've been seeking external validation when I should trust my own judgment more.",
      date: daysAgo(12),
    },
  ],
  goal: [
    {
      id: 'mock-insight-4',
      text: 'I want to establish a consistent morning routine that sets me up for success.',
      date: daysAgo(2),
    },
    {
      id: 'mock-insight-5',
      text: 'My goal is to have at least one meaningful conversation with a friend each week.',
      date: daysAgo(7),
    },
    {
      id: 'mock-insight-6',
      text: "I'm committing to reading for 30 minutes before bed instead of scrolling.",
      date: daysAgo(14),
    },
  ],
  gratitude: [
    {
      id: 'mock-insight-7',
      text: "Thankful for Sarah's unwavering support during this challenging transition.",
      date: daysAgo(1),
    },
    {
      id: 'mock-insight-8',
      text: 'Grateful for my health and the ability to take long walks in nature.',
      date: daysAgo(6),
    },
    {
      id: 'mock-insight-9',
      text: 'Appreciating the small moments - morning coffee, sunset views, good conversations.',
      date: daysAgo(11),
    },
  ],
  concern: [
    {
      id: 'mock-insight-10',
      text: "Worried that I'm not spending enough quality time with the people who matter most.",
      date: daysAgo(3),
    },
    {
      id: 'mock-insight-11',
      text: 'The constant work pressure is affecting my sleep and overall wellbeing.',
      date: daysAgo(8),
    },
    {
      id: 'mock-insight-12',
      text: "I'm concerned about falling back into old patterns of people-pleasing.",
      date: daysAgo(15),
    },
  ],
  question: [
    {
      id: 'mock-insight-13',
      text: "What would my life look like if I wasn't afraid of failure?",
      date: daysAgo(2),
    },
    {
      id: 'mock-insight-14',
      text: "Am I pursuing this career because I want to, or because it's expected of me?",
      date: daysAgo(9),
    },
    {
      id: 'mock-insight-15',
      text: 'How can I better balance ambition with contentment?',
      date: daysAgo(16),
    },
  ],
  learning: [
    {
      id: 'mock-insight-16',
      text: 'I learned that saying no to one thing means saying yes to something else.',
      date: daysAgo(4),
    },
    {
      id: 'mock-insight-17',
      text: "Rest is not laziness - it's essential for sustainable productivity.",
      date: daysAgo(10),
    },
    {
      id: 'mock-insight-18',
      text: 'Vulnerability in relationships builds deeper connections than appearing perfect.',
      date: daysAgo(17),
    },
  ],
  idea: [
    {
      id: 'mock-insight-19',
      text: 'Maybe I should try a digital detox weekend to reset my relationship with technology.',
      date: daysAgo(3),
    },
    {
      id: 'mock-insight-20',
      text: 'What if I started a gratitude journal to capture daily wins and blessings?',
      date: daysAgo(11),
    },
    {
      id: 'mock-insight-21',
      text: 'I could create a "worry time" - a designated 15 minutes to process anxious thoughts.',
      date: daysAgo(18),
    },
  ],
  inspiration: [
    {
      id: 'mock-insight-22',
      text: 'That podcast about resilience reminded me that setbacks are setups for comebacks.',
      date: daysAgo(5),
    },
    {
      id: 'mock-insight-23',
      text: 'Watching how Mom handles challenges with grace inspires me to cultivate patience.',
      date: daysAgo(13),
    },
    {
      id: 'mock-insight-24',
      text: "The book's message about embracing imperfection resonated deeply with me.",
      date: daysAgo(20),
    },
  ],
}

// ==========================================
// Mock Timeline (10 recent reflections)
// ==========================================

export const MOCK_TIMELINE = [
  {
    id: 'mock-timeline-1',
    date: daysAgo(0),
    summaryPreview:
      'A peaceful day of reflection on recent progress and gratitude for support...',
    mood: 'peaceful' as Mood,
    topics: ['gratitude', 'personal growth'],
  },
  {
    id: 'mock-timeline-2',
    date: daysAgo(1),
    summaryPreview:
      'Processed some work stress but found clarity on next steps...',
    mood: 'anxious' as Mood,
    topics: ['work', 'stress', 'goals'],
  },
  {
    id: 'mock-timeline-3',
    date: daysAgo(2),
    summaryPreview: 'Grateful for meaningful connections and family support...',
    mood: 'grateful' as Mood,
    topics: ['relationships', 'family', 'gratitude'],
  },
  {
    id: 'mock-timeline-4',
    date: daysAgo(3),
    summaryPreview: 'Explored questions about career direction and purpose...',
    mood: 'reflective' as Mood,
    topics: ['work', 'future', 'personal growth'],
  },
  {
    id: 'mock-timeline-5',
    date: daysAgo(5),
    summaryPreview: 'Breakthrough moment with the project at work...',
    mood: 'hopeful' as Mood,
    topics: ['work', 'goals'],
  },
  {
    id: 'mock-timeline-6',
    date: daysAgo(7),
    summaryPreview:
      'Focusing on self-care and establishing better boundaries...',
    mood: 'calm' as Mood,
    topics: ['self-care', 'boundaries', 'health'],
  },
  {
    id: 'mock-timeline-7',
    date: daysAgo(10),
    summaryPreview:
      'Difficult day but found silver linings in the challenges...',
    mood: 'frustrated' as Mood,
    topics: ['work', 'stress'],
  },
  {
    id: 'mock-timeline-8',
    date: daysAgo(12),
    summaryPreview:
      'Reflecting on relationships and how to nurture them better...',
    mood: 'contemplative' as Mood,
    topics: ['relationships', 'goals'],
  },
  {
    id: 'mock-timeline-9',
    date: daysAgo(14),
    summaryPreview: 'Excited about new possibilities and fresh starts...',
    mood: 'excited' as Mood,
    topics: ['future', 'goals', 'personal growth'],
  },
  {
    id: 'mock-timeline-10',
    date: daysAgo(17),
    summaryPreview:
      'Processing complex emotions about change and transition...',
    mood: 'uncertain' as Mood,
    topics: ['change', 'future'],
  },
]

// ==========================================
// Mock Overview
// ==========================================

export const MOCK_OVERVIEW = {
  totalReflections: 22,
  pendingTodos: 4,
  completedTodos: 3,
  trackedPeople: 8,
  recentMood: {
    mood: 'peaceful' as Mood,
    date: daysAgo(0),
  },
  topTopics: MOCK_TOPICS.slice(0, 5),
  recentInsights: [
    {
      id: 'mock-insight-1',
      text: 'I realized that my need for control comes from fear of uncertainty, not actual danger.',
      category: 'realization' as InsightCategory,
      date: daysAgo(1),
    },
    {
      id: 'mock-insight-4',
      text: 'I want to establish a consistent morning routine that sets me up for success.',
      category: 'goal' as InsightCategory,
      date: daysAgo(2),
    },
    {
      id: 'mock-insight-7',
      text: "Thankful for Sarah's unwavering support during this challenging transition.",
      category: 'gratitude' as InsightCategory,
      date: daysAgo(1),
    },
    {
      id: 'mock-insight-13',
      text: "What would my life look like if I wasn't afraid of failure?",
      category: 'question' as InsightCategory,
      date: daysAgo(2),
    },
    {
      id: 'mock-insight-19',
      text: 'Maybe I should try a digital detox weekend to reset my relationship with technology.',
      category: 'idea' as InsightCategory,
      date: daysAgo(3),
    },
  ],
}
