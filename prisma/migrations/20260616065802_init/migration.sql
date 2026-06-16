-- CreateTable
CREATE TABLE "products" (
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

-- CreateTable
CREATE TABLE "accounts" (
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

-- CreateTable
CREATE TABLE "assets" (
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

-- CreateTable
CREATE TABLE "platform_workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "template" TEXT,
    "status" TEXT,
    "current_node_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "platform_workflows_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "node_key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "label" TEXT,
    "type" TEXT,
    "kind" TEXT,
    "status" TEXT NOT NULL DEFAULT '未开始',
    "error" TEXT,
    "meta" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "workflow_nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "platform_workflows" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generation_tasks" (
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

-- CreateTable
CREATE TABLE "listing_tasks" (
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

-- CreateTable
CREATE TABLE "publish_tasks" (
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

-- CreateTable
CREATE TABLE "platform_product_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_product_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "platform_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT,
    "kind" TEXT,
    "message" TEXT,
    "level" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "assets_product_id_idx" ON "assets"("product_id");

-- CreateIndex
CREATE INDEX "platform_workflows_product_id_idx" ON "platform_workflows"("product_id");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflow_id_idx" ON "workflow_nodes"("workflow_id");

-- CreateIndex
CREATE INDEX "generation_tasks_product_id_idx" ON "generation_tasks"("product_id");

-- CreateIndex
CREATE INDEX "listing_tasks_product_id_idx" ON "listing_tasks"("product_id");

-- CreateIndex
CREATE INDEX "publish_tasks_product_id_idx" ON "publish_tasks"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_product_mappings_product_id_platform_key" ON "platform_product_mappings"("product_id", "platform");

-- CreateIndex
CREATE INDEX "operation_logs_product_id_idx" ON "operation_logs"("product_id");
