/*
  Warnings:

  - Added the required column `aspectRatio` to the `Videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `Videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fps` to the `Videos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resolution` to the `Videos` table without a default value. This is not possible if the table is not empty.
  - Made the column `codeFileName` on table `Videos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `videoFileName` on table `Videos` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "VideoSpecs" AS ENUM ('HD', 'FULL_HD', 'UHD_4K', 'UHD_8K');

-- AlterTable
ALTER TABLE "Videos" ADD COLUMN     "aspectRatio" TEXT NOT NULL,
ADD COLUMN     "duration" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "fps" TEXT NOT NULL,
ADD COLUMN     "resolution" TEXT NOT NULL,
ALTER COLUMN "codeFileName" SET NOT NULL,
ALTER COLUMN "videoFileName" SET NOT NULL;
