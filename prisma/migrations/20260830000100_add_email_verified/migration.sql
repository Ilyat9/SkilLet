-- AlterTable
-- Поле требуется PrismaAdapter (@auth/prisma-adapter): передаётся при user.create()
-- в OAuth-флоу Auth.js даже когда email не подтверждается провайдером.
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
