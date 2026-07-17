/*
  Warnings:

  - You are about to drop the column `prime` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "prime",
ADD COLUMN     "isPrime" BOOLEAN NOT NULL DEFAULT false;
