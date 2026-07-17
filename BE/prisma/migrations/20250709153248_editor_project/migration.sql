-- DropEnum
DROP TYPE "VideoSpecs";

-- CreateTable
CREATE TABLE "EditorProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EditorProjectToVideo" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EditorProjectToVideo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_EditorProjectToVideo_B_index" ON "_EditorProjectToVideo"("B");

-- AddForeignKey
ALTER TABLE "_EditorProjectToVideo" ADD CONSTRAINT "_EditorProjectToVideo_A_fkey" FOREIGN KEY ("A") REFERENCES "EditorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EditorProjectToVideo" ADD CONSTRAINT "_EditorProjectToVideo_B_fkey" FOREIGN KEY ("B") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
