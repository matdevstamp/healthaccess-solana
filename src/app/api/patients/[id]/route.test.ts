import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler tests for /api/patients/[id]. The route owns the id guard, the
 * per-patient access check and, crucially, the access-log event for every
 * outcome (view, view_denied, view_not_found) so the audit trail has no hole
 * where a read was not recorded.
 */

const cookieValue = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: cookieValue(name) }) }),
}));

const recordAccessEvent = vi.fn();
vi.mock("@/lib/outbox/record", () => ({ recordAccessEvent }));

const getDatabasePatientJournal = vi.fn();
vi.mock("@/lib/patients/journal", () => ({ getDatabasePatientJournal }));

const { GET } = await import("@/app/api/patients/[id]/route");
const { signSessionToken } = await import("@/lib/auth");
import { makeSessionUser } from "@/test-utils/session";
import type { SessionUser } from "@/lib/types/api";

const user = makeSessionUser;

function authenticate(session: SessionUser | null) {
  cookieValue.mockImplementation((name: string) =>
    name === "token" && session ? signSessionToken(session) : undefined,
  );
}

function get(id: string) {
  return GET(new Request(`http://localhost:3000/api/patients/${id}`), {
    params: Promise.resolve({ id }),
  });
}

const journal = {
  patient: {
    id: 1,
    name: "Anna Andersson",
    dateOfBirth: "1990-01-01",
    personalNumber: "199001011234",
    recordCount: 1,
    noteCount: 1,
    lastVisit: "2026-08-18",
  },
  records: [],
  notes: [],
  accessLogs: [],
  isOwnJournal: false,
  viewerRole: "doctor" as const,
  viewerUserId: 1,
  hiddenNotesCount: 0,
};

beforeEach(() => {
  cookieValue.mockReset();
  recordAccessEvent.mockReset().mockResolvedValue({ eventId: "evt-1" });
  getDatabasePatientJournal.mockReset().mockResolvedValue(journal);
});

describe("GET /api/patients/[id]", () => {
  it("returns 401 without a session", async () => {
    authenticate(null);

    const response = await get("1");

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a role without readPatient", async () => {
    authenticate(user("unauthorized"));

    expect((await get("1")).status).toBe(403);
  });

  it.each(["abc", "0", "-2", "1.5", "1e400"])("returns 400 for the id %s", async (id) => {
    authenticate(user("doctor"));

    const response = await get(id);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_PATIENT_ID");
  });

  it("returns 403 and logs view_denied when a patient opens someone else's journal", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));

    const response = await get("2");

    expect(response.status).toBe(403);
    expect(recordAccessEvent).toHaveBeenCalledWith({
      userId: 4,
      patientId: 2,
      recordId: null,
      action: "view_denied",
      serverId: expect.any(String),
      role: "patient",
    });
  });

  it("awaits the durable outbox write for a denied event", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));
    let written = false;
    recordAccessEvent.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      written = true;
      return { eventId: "evt-1" };
    });

    await get("2");

    expect(written).toBe(true);
  });

  it("returns 404 and logs view_not_found for a missing patient", async () => {
    authenticate(user("doctor"));
    getDatabasePatientJournal.mockResolvedValue(null);

    const response = await get("99");

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PATIENT_NOT_FOUND");
    expect(recordAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 99, action: "view_not_found" }),
    );
  });

  it("returns the journal and logs a view event", async () => {
    authenticate(user("doctor"));

    const response = await get("1");
    const body = (await response.json()) as { ok: boolean; data: typeof journal };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.patient.name).toBe("Anna Andersson");
    expect(recordAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, patientId: 1, recordId: null, action: "view" }),
    );
  });

  it("fails the read closed when the audit write fails", async () => {
    // Deliberate, and the reason it is worth a test: returning a patient's
    // record while silently dropping the record that they read it is exactly
    // the failure mode an audit trail exists to prevent.
    authenticate(user("doctor"));
    recordAccessEvent.mockRejectedValue(new Error("db gone"));

    const response = await get("1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("PATIENT_JOURNAL_FAILED");
  });

  it("lets a patient open their own journal", async () => {
    authenticate(user("patient", { id: 4, patientId: 1 }));

    const response = await get("1");

    expect(response.status).toBe(200);
    expect(recordAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 1, action: "view" }),
    );
  });

  it("tags the access log with this server's id", async () => {
    authenticate(user("doctor"));

    await get("1");

    const { serverId } = recordAccessEvent.mock.calls[0]?.[0] as { serverId: string };
    expect(serverId).toBe(process.env.SERVER_ID);
  });

  it("returns 500 when the journal lookup throws", async () => {
    authenticate(user("doctor"));
    getDatabasePatientJournal.mockRejectedValue(new Error("db down"));

    const response = await get("1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("PATIENT_JOURNAL_FAILED");
  });
});
