-- Snapshot the acting role at enqueue time.
--
-- The flusher and verify both build the on-chain payload from
-- `actor_role`. A live join to `users.role` would let a role change after
-- recording silently change what gets anchored, so the value is fixed at
-- insert. Backfill existing rows from the users table so the NOT NULL
-- constraint holds for pre-existing data too.

ALTER TABLE "access_logs" ADD COLUMN "actor_role" TEXT;

UPDATE "access_logs" AS al
SET "actor_role" = u."role"
FROM "users" u
WHERE u."id" = al."user_id";

ALTER TABLE "access_logs" ALTER COLUMN "actor_role" SET NOT NULL;