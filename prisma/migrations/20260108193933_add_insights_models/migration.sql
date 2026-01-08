-- CreateTable
CREATE TABLE "reflection_mood" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reflection_mood_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reflection_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reflection_topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reflection_topic_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reflection_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reflection_insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reflection_insight_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reflection_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dueDate" DATETIME,
    "priority" TEXT,
    "context" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "sourceSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "mentionCount" INTEGER NOT NULL DEFAULT 1,
    "averageSentiment" REAL,
    "lastMentioned" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "person_mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sentiment" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "person_mention_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "person_mention_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reflection_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "reflection_mood_sessionId_key" ON "reflection_mood"("sessionId");

-- CreateIndex
CREATE INDEX "reflection_topic_sessionId_idx" ON "reflection_topic"("sessionId");

-- CreateIndex
CREATE INDEX "reflection_insight_sessionId_idx" ON "reflection_insight"("sessionId");

-- CreateIndex
CREATE INDEX "reflection_insight_category_idx" ON "reflection_insight"("category");

-- CreateIndex
CREATE INDEX "todo_userId_completed_idx" ON "todo"("userId", "completed");

-- CreateIndex
CREATE INDEX "todo_sourceSessionId_idx" ON "todo"("sourceSessionId");

-- CreateIndex
CREATE INDEX "person_userId_idx" ON "person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "person_userId_name_key" ON "person"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "person_mention_personId_sessionId_key" ON "person_mention"("personId", "sessionId");
