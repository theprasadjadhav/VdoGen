/*
  Warnings:

  - Added the required column `userId` to the `EditorProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EditorProject" ADD COLUMN     "userId" TEXT NOT NULL;
