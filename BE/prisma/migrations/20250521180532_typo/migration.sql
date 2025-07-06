/*
  Warnings:

  - You are about to drop the column `idError` on the `Videos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Videos" DROP COLUMN "idError",
ADD COLUMN     "isError" BOOLEAN NOT NULL DEFAULT false;
