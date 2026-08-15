


-- CreateEnum
CREATE TYPE "StreakStatus" AS ENUM ('ACTIVE', 'ISSUED', 'EXPIRED');

-- CreateTable
CREATE TABLE "streak_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "StreakStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streak_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "streak_challenges_userId_idx" ON "streak_challenges"("userId");

-- CreateIndex
CREATE INDEX "streak_challenges_status_idx" ON "streak_challenges"("status");

-- AddForeignKey
ALTER TABLE "streak_challenges" ADD CONSTRAINT "streak_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_challenges" ADD CONSTRAINT "streak_challenges_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
