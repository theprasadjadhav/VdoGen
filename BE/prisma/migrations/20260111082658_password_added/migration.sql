/*
  Warnings:

  - The values [CUSTOM] on the enum `Provider` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Provider_new" AS ENUM ('GOOGLE', 'GITHUB', 'TWITTER', 'MICROSOFT', 'APPLE', 'Email');
ALTER TABLE "public"."UserIdentities" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "UserIdentities" ALTER COLUMN "provider" TYPE "Provider_new" USING ("provider"::text::"Provider_new");
ALTER TYPE "Provider" RENAME TO "Provider_old";
ALTER TYPE "Provider_new" RENAME TO "Provider";
DROP TYPE "public"."Provider_old";
ALTER TABLE "UserIdentities" ALTER COLUMN "provider" SET DEFAULT 'Email';
COMMIT;

-- AlterTable
ALTER TABLE "UserIdentities" ADD COLUMN     "password" TEXT,
ALTER COLUMN "provider" SET DEFAULT 'Email';
