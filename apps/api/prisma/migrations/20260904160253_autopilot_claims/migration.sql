-- AlterTable
ALTER TABLE "CircleCycle" ADD COLUMN     "payoutClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CircleMembership" ADD COLUMN     "autoCollect" BOOLEAN NOT NULL DEFAULT true;
