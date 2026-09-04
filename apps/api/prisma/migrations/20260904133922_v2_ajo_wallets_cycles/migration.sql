-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('pending', 'collecting', 'payout_completed');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('demo_fund', 'fund', 'circle_contribution', 'circle_payout');

-- AlterEnum
ALTER TYPE "CircleStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "contributionAmount" DECIMAL(18,2),
ADD COLUMN     "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "rotationMode" TEXT NOT NULL DEFAULT 'random_draw',
ADD COLUMN     "rotationOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetMembers" INTEGER;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "cycleId" TEXT;

-- CreateTable
CREATE TABLE "CircleCycle" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "recipientId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "targetPot" DECIMAL(18,2) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "CircleCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "relatedCircleId" TEXT,
    "relatedCycleId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleCycle_circleId_idx" ON "CircleCycle"("circleId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleCycle_circleId_cycleNumber_key" ON "CircleCycle"("circleId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_walletId_idempotencyKey_key" ON "WalletTransaction"("walletId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "CircleCycle" ADD CONSTRAINT "CircleCycle_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleCycle" ADD CONSTRAINT "CircleCycle_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
