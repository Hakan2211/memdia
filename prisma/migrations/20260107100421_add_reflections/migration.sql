-- CreateTable
CREATE TABLE "daily_greeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "text" TEXT NOT NULL,
    "audioBase64" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "reflection_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recordingAttempt" INTEGER NOT NULL DEFAULT 1,
    "totalUserSpeakingTime" INTEGER NOT NULL DEFAULT 0,
    "maxDuration" INTEGER NOT NULL DEFAULT 600,
    "summaryText" TEXT,
    "pausedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reflection_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reflection_turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "startTime" REAL NOT NULL,
    "duration" REAL NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reflection_turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "reflection_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deleted_reflection_attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_reflection_greeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "text" TEXT NOT NULL,
    "audioBase64" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "imageStyle" TEXT NOT NULL DEFAULT 'realistic',
    "aiPersonality" TEXT NOT NULL DEFAULT 'empathetic',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_preferences" ("aiPersonality", "createdAt", "id", "imageStyle", "timezone", "updatedAt", "userId") SELECT "aiPersonality", "createdAt", "id", "imageStyle", "timezone", "updatedAt", "userId" FROM "user_preferences";
DROP TABLE "user_preferences";
ALTER TABLE "new_user_preferences" RENAME TO "user_preferences";
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");
CREATE TABLE "new_voice_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recordingAttempt" INTEGER NOT NULL DEFAULT 1,
    "totalUserSpeakingTime" INTEGER NOT NULL DEFAULT 0,
    "maxDuration" INTEGER NOT NULL DEFAULT 180,
    "summaryText" TEXT,
    "imageUrl" TEXT,
    "imageStyle" TEXT NOT NULL DEFAULT 'realistic',
    "archivalStatus" TEXT NOT NULL DEFAULT 'pending',
    "pausedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "voice_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_voice_session" ("completedAt", "createdAt", "date", "id", "imageStyle", "imageUrl", "maxDuration", "pausedAt", "recordingAttempt", "status", "summaryText", "totalUserSpeakingTime", "updatedAt", "userId") SELECT "completedAt", "createdAt", "date", "id", "imageStyle", "imageUrl", "maxDuration", "pausedAt", "recordingAttempt", "status", "summaryText", "totalUserSpeakingTime", "updatedAt", "userId" FROM "voice_session";
DROP TABLE "voice_session";
ALTER TABLE "new_voice_session" RENAME TO "voice_session";
CREATE UNIQUE INDEX "voice_session_userId_date_key" ON "voice_session"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "daily_greeting_userId_date_language_key" ON "daily_greeting"("userId", "date", "language");

-- CreateIndex
CREATE UNIQUE INDEX "reflection_session_userId_date_key" ON "reflection_session"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "deleted_reflection_attempt_userId_date_key" ON "deleted_reflection_attempt"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reflection_greeting_userId_date_language_key" ON "daily_reflection_greeting"("userId", "date", "language");
