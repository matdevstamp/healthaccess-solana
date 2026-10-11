-- Task 31 follow-up: drop the AccessLog -> Patient foreign key.
--
-- `GET /api/patients/999` records a `view_not_found` event. There is no
-- Patient row 999, so the insert violated the FK constraint, the write threw,
-- and a 404 came back as a 500. The audit entry for "someone looked for a
-- patient that does not exist" is the one entry you least want to be
-- suppressed by the absence of its subject.
--
-- The same reasoning covers Patient deletion: an audit trail that can lose rows
-- when a referenced record is removed is not an audit trail.
--
-- patient_id stays NOT NULL. Every event knows the id that was asked about;
-- it simply is not required to correspond to a row.

ALTER TABLE "access_logs" DROP CONSTRAINT IF EXISTS "access_logs_patient_id_fkey";
