-- CreateTable
CREATE TABLE "deleted_session_attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "deleted_session_attempt_userId_date_key" ON "deleted_session_attempt"("userId", "date");
