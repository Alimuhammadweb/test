-- Just Mind upgrade. Non-destructive: every existing post, slug, category,
-- category assignment, tag, view and media row is preserved.
-- Prisma runs this file as one implicit transaction: if any statement (including the
-- safety checks below) fails, NOTHING is changed.

-- 1. Enum for media type ------------------------------------------------------
CREATE TYPE "MediaType" AS ENUM ('IMAGE');

-- 2. Categories: description + display order ----------------------------------
ALTER TABLE "Category"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

-- 3. Many-to-many Post <-> Category ------------------------------------------
CREATE TABLE "PostCategory" (
    "postId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PostCategory_pkey" PRIMARY KEY ("postId","categoryId")
);

CREATE INDEX "PostCategory_categoryId_idx" ON "PostCategory"("categoryId");

ALTER TABLE "PostCategory" ADD CONSTRAINT "PostCategory_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostCategory" ADD CONSTRAINT "PostCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over every existing single-category assignment.
INSERT INTO "PostCategory" ("postId", "categoryId")
SELECT "id", "categoryId" FROM "Post" WHERE "categoryId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Safety check: refuse to drop the old column unless every assignment was copied.
DO $$
BEGIN
  IF (SELECT count(*) FROM "Post" WHERE "categoryId" IS NOT NULL)
     <> (SELECT count(*) FROM "PostCategory") THEN
    RAISE EXCEPTION 'Category migration check failed: assignments were not copied 1:1. Nothing was changed.';
  END IF;
END $$;

DROP INDEX "Post_categoryId_idx";
ALTER TABLE "Post" DROP CONSTRAINT "Post_categoryId_fkey";
ALTER TABLE "Post" DROP COLUMN "categoryId";

-- 4. Media: binary image storage in PostgreSQL --------------------------------
ALTER TABLE "Media"
  ALTER COLUMN "url" DROP NOT NULL,           -- old rows keep their URL; new rows use "data"
  ADD COLUMN "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
  ADD COLUMN "data" BYTEA,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "filename" TEXT,
  ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "alt" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Give existing images a stable order per post (ids are time-ordered).
UPDATE "Media" m SET "order" = r.rn - 1
FROM (SELECT "id", row_number() OVER (PARTITION BY "postId" ORDER BY "id") AS rn FROM "Media") r
WHERE m."id" = r."id";

CREATE INDEX "Media_postId_order_idx" ON "Media"("postId", "order");

-- 5. Initial categories (skipped if the name or slug already exists) ----------
INSERT INTO "Category" ("id", "name", "slug", "sortOrder") VALUES
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Shaxsiy rivojlanish', 'shaxsiy-rivojlanish', 1),
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Kitoblar', 'kitoblar', 2),
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Loyihalarim', 'loyihalarim', 3),
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'IT va texnologiya', 'it-va-texnologiya', 4),
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Foydali ma''lumotlar', 'foydali-malumotlar', 5),
  ('cat_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Fikrlarim', 'fikrlarim', 6)
ON CONFLICT DO NOTHING;

-- If one of the six already existed (e.g. from the old demo seed), place it in the intended order too.
UPDATE "Category" SET "sortOrder" = 1 WHERE "slug" = 'shaxsiy-rivojlanish' AND "sortOrder" = 100;
UPDATE "Category" SET "sortOrder" = 2 WHERE "slug" = 'kitoblar' AND "sortOrder" = 100;
UPDATE "Category" SET "sortOrder" = 3 WHERE "slug" = 'loyihalarim' AND "sortOrder" = 100;
UPDATE "Category" SET "sortOrder" = 4 WHERE "slug" = 'it-va-texnologiya' AND "sortOrder" = 100;
UPDATE "Category" SET "sortOrder" = 5 WHERE "slug" = 'foydali-malumotlar' AND "sortOrder" = 100;
UPDATE "Category" SET "sortOrder" = 6 WHERE "slug" = 'fikrlarim' AND "sortOrder" = 100;
