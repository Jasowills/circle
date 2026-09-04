-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "contributionsPerWeek" INTEGER;

-- AlterTable
ALTER TABLE "CircleMembership" ADD COLUMN     "autoContribute" BOOLEAN NOT NULL DEFAULT false;
