-- AlterTable
ALTER TABLE "Videos" ADD COLUMN     "Error" TEXT,
ADD COLUMN     "idError" BOOLEAN NOT NULL DEFAULT false;
