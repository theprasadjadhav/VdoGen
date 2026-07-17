/*
  Warnings:

  - You are about to drop the column `config` on the `EditorProject` table. All the data in the column will be lost.
  - Added the required column `data` to the `EditorProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EditorProject" DROP COLUMN "config",
ADD COLUMN     "data" TEXT NOT NULL;
