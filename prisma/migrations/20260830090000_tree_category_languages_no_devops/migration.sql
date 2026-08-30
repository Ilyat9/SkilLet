-- Postgres не поддерживает удаление значения enum (только ADD VALUE), поэтому
-- убрать DEVOPS можно только пересозданием типа. Сначала переносим все
-- деревья с category = 'DEVOPS' на 'OTHER' (безопасный дефолт), чтобы ни одна
-- строка не осталась со значением, которого не будет в новом типе.
UPDATE "Tree" SET "category" = 'OTHER' WHERE "category" = 'DEVOPS';

ALTER TYPE "TreeCategory" RENAME TO "TreeCategory_old";

CREATE TYPE "TreeCategory" AS ENUM ('FRONTEND', 'BACKEND', 'DATA_SCIENCE', 'SOFT_SKILLS', 'DESIGN', 'LANGUAGES', 'OTHER');

ALTER TABLE "Tree" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Tree" ALTER COLUMN "category" TYPE "TreeCategory" USING ("category"::text::"TreeCategory");
ALTER TABLE "Tree" ALTER COLUMN "category" SET DEFAULT 'OTHER';

DROP TYPE "TreeCategory_old";
