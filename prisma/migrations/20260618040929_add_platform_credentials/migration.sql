-- CreateTable
CREATE TABLE "platform_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "api" TEXT NOT NULL,
    "label" TEXT,
    "role" TEXT,
    "app_key" TEXT,
    "app_secret_enc" TEXT,
    "shop_id" TEXT,
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at" DATETIME,
    "refresh_expires_at" DATETIME,
    "runMode" TEXT NOT NULL DEFAULT 'demo',
    "status" TEXT NOT NULL DEFAULT '未授权',
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "platform_credentials_platform_api_idx" ON "platform_credentials"("platform", "api");
