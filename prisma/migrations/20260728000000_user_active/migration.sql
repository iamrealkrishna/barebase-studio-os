-- Deactivation instead of deletion: a user who has authored projects, versions
-- or audit events must keep them, so access is revoked by flag rather than by
-- removing the row.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);
