-- Task 26: crash-safe claim bookkeeping.
--
-- `claim` moves a row pending → flushing so two servers cannot flush the same
-- entry. That exclusivity is not crash-safe on its own: a process killed
-- mid-flush would strand its rows in `flushing` forever. `claimed_at` is the
-- clock the stale-claim sweep reads, which is what makes the flusher idempotent
-- across restart rather than merely restart-tolerant.
--
-- `client_time` cannot serve that purpose: it is the *event's* timestamp, not
-- the moment a worker picked the row up.

ALTER TABLE "access_logs" ADD COLUMN "claimed_at" TIMESTAMP(3);

CREATE INDEX "idx_access_logs_flushing" ON "access_logs"("status", "claimed_at")
  WHERE "status" = 'flushing';