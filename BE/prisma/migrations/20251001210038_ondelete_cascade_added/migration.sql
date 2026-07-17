-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_conversationId_fkey";

-- AlterTable
ALTER TABLE "Video" ALTER COLUMN "status" SET DEFAULT 'Initiated';

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
