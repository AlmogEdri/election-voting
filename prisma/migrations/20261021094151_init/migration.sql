-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "name_norm" TEXT NOT NULL,
    "device_token" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "letters" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "bloc" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "default_seats" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "pm_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "party_id" TEXT,
    "sort" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "pm_candidates_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "seats" TEXT NOT NULL,
    "pm_candidate_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_pm_candidate_id_fkey" FOREIGN KEY ("pm_candidate_id") REFERENCES "pm_candidates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_norm_key" ON "users"("name_norm");

-- CreateIndex
CREATE UNIQUE INDEX "users_device_token_key" ON "users"("device_token");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_key" ON "votes"("user_id");
