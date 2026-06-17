-- CreateTable
CREATE TABLE "reference_videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "media_url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);
