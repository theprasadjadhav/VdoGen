/*
  Warnings:

  - You are about to drop the `Videos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Videos";

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "firstPrompt" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" SERIAL NOT NULL,
    "prompt" TEXT NOT NULL,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "Error" TEXT,
    "codeFileName" TEXT,
    "resolution" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "fps" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
