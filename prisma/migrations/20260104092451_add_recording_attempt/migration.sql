-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "imageStyle" TEXT NOT NULL DEFAULT 'realistic',
    "aiPersonality" TEXT NOT NULL DEFAULT 'empathetic',
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
    "pausedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "voice_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_voice_session" ("completedAt", "createdAt", "date", "id", "imageStyle", "imageUrl", "maxDuration", "pausedAt", "status", "summaryText", "totalUserSpeakingTime", "updatedAt", "userId") SELECT "completedAt", "createdAt", "date", "id", "imageStyle", "imageUrl", "maxDuration", "pausedAt", "status", "summaryText", "totalUserSpeakingTime", "updatedAt", "userId" FROM "voice_session";
DROP TABLE "voice_session";
ALTER TABLE "new_voice_session" RENAME TO "voice_session";
CREATE UNIQUE INDEX "voice_session_userId_date_key" ON "voice_session"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
