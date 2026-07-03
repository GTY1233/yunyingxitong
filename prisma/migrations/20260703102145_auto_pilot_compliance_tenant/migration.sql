-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT,
    "name" TEXT,
    "type" TEXT,
    "role" TEXT,
    "auth" TEXT,
    "rule" TEXT,
    "persona" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);
INSERT INTO "new_accounts" ("auth", "created_at", "deleted_at", "id", "is_demo", "name", "persona", "platform", "role", "rule", "type", "updated_at") SELECT "auth", "created_at", "deleted_at", "id", "is_demo", "name", "persona", "platform", "role", "rule", "type", "updated_at" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE TABLE "new_assets" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "generation_task_id" TEXT,
    "kind" TEXT NOT NULL,
    "type" TEXT,
    "name" TEXT,
    "status" TEXT,
    "usage" TEXT,
    "version" TEXT,
    "provider" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_note" TEXT,
    "content" TEXT,
    "media_url" TEXT,
    "poster_url" TEXT,
    "aspect_ratio" TEXT,
    "duration" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assets" ("aspect_ratio", "content", "created_at", "deleted_at", "duration", "generation_task_id", "id", "is_primary", "kind", "media_url", "name", "poster_url", "product_id", "provider", "status", "type", "updated_at", "usage", "version") SELECT "aspect_ratio", "content", "created_at", "deleted_at", "duration", "generation_task_id", "id", "is_primary", "kind", "media_url", "name", "poster_url", "product_id", "provider", "status", "type", "updated_at", "usage", "version" FROM "assets";
DROP TABLE "assets";
ALTER TABLE "new_assets" RENAME TO "assets";
CREATE INDEX "assets_product_id_idx" ON "assets"("product_id");
CREATE TABLE "new_generation_tasks" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "platform_workflow_id" TEXT,
    "asset_id" TEXT,
    "kind" TEXT,
    "type" TEXT,
    "label" TEXT,
    "params" TEXT,
    "status" TEXT,
    "provider" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 2,
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "generation_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_generation_tasks" ("asset_id", "attempts", "created_at", "deleted_at", "error", "finished_at", "id", "kind", "label", "max_attempts", "params", "platform_workflow_id", "product_id", "provider", "started_at", "status", "type", "updated_at") SELECT "asset_id", "attempts", "created_at", "deleted_at", "error", "finished_at", "id", "kind", "label", "max_attempts", "params", "platform_workflow_id", "product_id", "provider", "started_at", "status", "type", "updated_at" FROM "generation_tasks";
DROP TABLE "generation_tasks";
ALTER TABLE "new_generation_tasks" RENAME TO "generation_tasks";
CREATE INDEX "generation_tasks_product_id_idx" ON "generation_tasks"("product_id");
CREATE TABLE "new_listing_tasks" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "account_id" TEXT,
    "platform" TEXT,
    "status" TEXT,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "missing" TEXT,
    "mode" TEXT,
    "platform_mode" TEXT,
    "platform_capability" TEXT,
    "external_id" TEXT,
    "platform_response" TEXT,
    "failure_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 2,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "listing_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "listing_tasks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_listing_tasks" ("account_id", "attempts", "completeness", "created_at", "deleted_at", "external_id", "failure_reason", "id", "max_attempts", "missing", "mode", "platform", "platform_capability", "platform_mode", "platform_response", "product_id", "status", "updated_at") SELECT "account_id", "attempts", "completeness", "created_at", "deleted_at", "external_id", "failure_reason", "id", "max_attempts", "missing", "mode", "platform", "platform_capability", "platform_mode", "platform_response", "product_id", "status", "updated_at" FROM "listing_tasks";
DROP TABLE "listing_tasks";
ALTER TABLE "new_listing_tasks" RENAME TO "listing_tasks";
CREATE INDEX "listing_tasks_product_id_idx" ON "listing_tasks"("product_id");
CREATE TABLE "new_model_images" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "media_url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);
INSERT INTO "new_model_images" ("created_at", "deleted_at", "id", "media_url", "name") SELECT "created_at", "deleted_at", "id", "media_url", "name" FROM "model_images";
DROP TABLE "model_images";
ALTER TABLE "new_model_images" RENAME TO "model_images";
CREATE TABLE "new_operation_logs" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT,
    "kind" TEXT,
    "message" TEXT,
    "level" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_operation_logs" ("created_at", "id", "kind", "level", "message", "product_id") SELECT "created_at", "id", "kind", "level", "message", "product_id" FROM "operation_logs";
DROP TABLE "operation_logs";
ALTER TABLE "new_operation_logs" RENAME TO "operation_logs";
CREATE INDEX "operation_logs_product_id_idx" ON "operation_logs"("product_id");
CREATE TABLE "new_platform_credentials" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
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
INSERT INTO "new_platform_credentials" ("access_token_enc", "api", "app_key", "app_secret_enc", "created_at", "deleted_at", "id", "label", "last_error", "platform", "refresh_expires_at", "refresh_token_enc", "role", "runMode", "shop_id", "status", "token_expires_at", "updated_at") SELECT "access_token_enc", "api", "app_key", "app_secret_enc", "created_at", "deleted_at", "id", "label", "last_error", "platform", "refresh_expires_at", "refresh_token_enc", "role", "runMode", "shop_id", "status", "token_expires_at", "updated_at" FROM "platform_credentials";
DROP TABLE "platform_credentials";
ALTER TABLE "new_platform_credentials" RENAME TO "platform_credentials";
CREATE INDEX "platform_credentials_platform_api_idx" ON "platform_credentials"("platform", "api");
CREATE TABLE "new_platform_product_mappings" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_product_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "platform_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_platform_product_mappings" ("created_at", "external_product_id", "id", "platform", "product_id", "updated_at") SELECT "created_at", "external_product_id", "id", "platform", "product_id", "updated_at" FROM "platform_product_mappings";
DROP TABLE "platform_product_mappings";
ALTER TABLE "new_platform_product_mappings" RENAME TO "platform_product_mappings";
CREATE UNIQUE INDEX "platform_product_mappings_product_id_platform_key" ON "platform_product_mappings"("product_id", "platform");
CREATE TABLE "new_platform_workflows" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "template" TEXT,
    "status" TEXT,
    "current_node_id" TEXT,
    "auto_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "platform_workflows_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_platform_workflows" ("created_at", "current_node_id", "deleted_at", "id", "platform", "product_id", "status", "template", "updated_at") SELECT "created_at", "current_node_id", "deleted_at", "id", "platform", "product_id", "status", "template", "updated_at" FROM "platform_workflows";
DROP TABLE "platform_workflows";
ALTER TABLE "new_platform_workflows" RENAME TO "platform_workflows";
CREATE INDEX "platform_workflows_product_id_idx" ON "platform_workflows"("product_id");
CREATE TABLE "new_products" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_code" TEXT,
    "sku_code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price_cents" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "warning_stock" INTEGER NOT NULL DEFAULT 0,
    "selling_points" TEXT,
    "specs" TEXT,
    "platforms" TEXT,
    "colors" TEXT,
    "status" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);
INSERT INTO "new_products" ("category", "colors", "created_at", "deleted_at", "display_code", "id", "name", "platforms", "price_cents", "selling_points", "sku_code", "specs", "status", "stock", "updated_at", "warning_stock") SELECT "category", "colors", "created_at", "deleted_at", "display_code", "id", "name", "platforms", "price_cents", "selling_points", "sku_code", "specs", "status", "stock", "updated_at", "warning_stock" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE TABLE "new_publish_tasks" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "account_id" TEXT,
    "asset_id" TEXT,
    "platform" TEXT,
    "status" TEXT,
    "schedule_slot" TEXT,
    "scheduled_at" DATETIME,
    "published_at" DATETIME,
    "attach_product" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT,
    "failure_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 2,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "publish_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "publish_tasks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_publish_tasks" ("account_id", "asset_id", "attach_product", "attempts", "created_at", "deleted_at", "failure_reason", "id", "max_attempts", "mode", "platform", "product_id", "published_at", "schedule_slot", "scheduled_at", "status", "updated_at") SELECT "account_id", "asset_id", "attach_product", "attempts", "created_at", "deleted_at", "failure_reason", "id", "max_attempts", "mode", "platform", "product_id", "published_at", "schedule_slot", "scheduled_at", "status", "updated_at" FROM "publish_tasks";
DROP TABLE "publish_tasks";
ALTER TABLE "new_publish_tasks" RENAME TO "publish_tasks";
CREATE INDEX "publish_tasks_product_id_idx" ON "publish_tasks"("product_id");
CREATE TABLE "new_reference_videos" (
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "media_url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);
INSERT INTO "new_reference_videos" ("created_at", "deleted_at", "id", "media_url", "name") SELECT "created_at", "deleted_at", "id", "media_url", "name" FROM "reference_videos";
DROP TABLE "reference_videos";
ALTER TABLE "new_reference_videos" RENAME TO "reference_videos";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
