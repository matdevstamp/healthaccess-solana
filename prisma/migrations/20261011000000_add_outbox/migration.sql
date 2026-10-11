-- Task 26: durable outbox.
--
-- `blockchain_synced` was a boolean nobody set and nobody read. Replacing it
-- with a status string plus attempt/error turns "did this get anchored?" from a
-- guess into a query, and makes a stuck flusher visible instead of silent.
--
-- `event_id` is nullable so existing rows keep their place; every new row
-- writes one. `slot` is BIGINT because Solana slots outgrow
-- Number.MAX_SAFE_INTEGER and JSON-serialising them as a JS number corrupts
-- them silently.

ALTER TABLE "access_logs" ADD COLUMN "event_id" TEXT;
ALTER TABLE "access_logs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "access_logs" ADD COLUMN "slot" BIGINT;
ALTER TABLE "access_logs" ADD COLUMN "signature" TEXT;
ALTER TABLE "access_logs" ADD COLUMN "head_hash" TEXT;
ALTER TABLE "access_logs" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "access_logs" ADD COLUMN "error" TEXT;
ALTER TABLE "access_logs" ADD COLUMN "client_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "blockchain_synced";

ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "blockchain_synced";

CREATE UNIQUE INDEX "access_logs_event_id_key" ON "access_logs"("event_id");

-- The flusher's hot path: pending rows in insertion order.
CREATE INDEX "idx_access_logs_status" ON "access_logs"("status", "id");