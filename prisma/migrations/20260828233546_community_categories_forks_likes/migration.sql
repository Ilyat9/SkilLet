-- CreateEnum
CREATE TYPE "TreeCategory" AS ENUM ('FRONTEND', 'BACKEND', 'DEVOPS', 'DATA_SCIENCE', 'SOFT_SKILLS', 'DESIGN', 'OTHER');

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "category" "TreeCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "forkedFromId" TEXT;

-- CreateTable
CREATE TABLE "TreeLike" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,

    CONSTRAINT "TreeLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreeLike_treeId_idx" ON "TreeLike"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "TreeLike_userId_treeId_key" ON "TreeLike"("userId", "treeId");

-- CreateIndex
CREATE INDEX "Comment_treeId_createdAt_idx" ON "Comment"("treeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Tree_isPublic_category_createdAt_idx" ON "Tree"("isPublic", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Tree_forkedFromId_idx" ON "Tree"("forkedFromId");

-- AddForeignKey
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Tree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeLike" ADD CONSTRAINT "TreeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeLike" ADD CONSTRAINT "TreeLike_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
