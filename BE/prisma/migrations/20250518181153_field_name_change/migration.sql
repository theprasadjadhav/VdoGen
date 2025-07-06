/*
  Warnings:

  - You are about to drop the column `codeLink` on the `Videos` table. All the data in the column will be lost.
  - You are about to drop the column `videoLink` on the `Videos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Videos" DROP COLUMN "codeLink",
DROP COLUMN "videoLink",
ADD COLUMN     "codeFileName" TEXT,
ADD COLUMN     "videoFileName" TEXT;
