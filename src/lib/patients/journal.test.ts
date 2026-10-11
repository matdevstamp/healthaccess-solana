import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Role, SessionUser } from "@/lib/types/api";

/**
 * getDatabasePatientJournal assembles the journal payload from Prisma rows and
 * applies the shared visibility rule. Prisma is mocked; the SQL itself is
 * covered by the Playwright specs.
 */

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { patient: { findUnique } },
}));

const { getDatabasePatientJournal } = await import("@/lib/patients/journal");

function viewer(role: Role, overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    username: `${role}_test`,
    role,
    organizationId: null,
    patientId: null,
    ...overrides,
  };
}

function note(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    content: "note",
    visibility: "all",
    authorId: 1,
    createdAt: new Date("2026-08-18T10:42:00.000Z"),
    updatedAt: new Date("2026-08-18T10:42:00.000Z"),
    author: { id: 1, username: "dr_test" },
    ...overrides,
  };
}

function patientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    firstName: "Anna",
    lastName: "Kowalska",
    dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
    personalNumber: "199001011234",
    records: [
      {
        id: 1,
        recordType: "diagnosis",
        content: "Mild asthma.",
        createdAt: new Date("2026-08-18T00:00:00.000Z"),
        author: { id: 1, username: "dr_test" },
        notes: [note()],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findUnique.mockReset();
});

describe("getDatabasePatientJournal", () => {
  it("returns null for a patient that does not exist", async () => {
    findUnique.mockResolvedValue(null);

    expect(await getDatabasePatientJournal(999, viewer("doctor"))).toBeNull();
  });

  it("looks the patient up by id", async () => {
    findUnique.mockResolvedValue(patientRow());

    await getDatabasePatientJournal(1, viewer("doctor"));

    expect(findUnique.mock.calls[0]?.[0]).toMatchObject({ where: { id: 1 } });
  });

  it("summarises the patient and orders records newest first", async () => {
    findUnique.mockResolvedValue(patientRow());

    const journal = await getDatabasePatientJournal(1, viewer("doctor"));

    expect(journal?.patient).toEqual({
      id: 1,
      name: "Anna Kowalska",
      dateOfBirth: "1990-01-01",
      personalNumber: "199001011234",
      recordCount: 1,
      noteCount: 1,
      lastVisit: "2026-08-18",
    });
    expect(journal?.records[0]).toEqual({
      id: 1,
      date: "2026-08-18",
      title: "diagnosis",
      practitioner: "dr_test",
      summary: "Mild asthma.",
    });
  });

  it("uses '-' as lastVisit when the patient has no records", async () => {
    findUnique.mockResolvedValue(patientRow({ records: [] }));

    const journal = await getDatabasePatientJournal(1, viewer("doctor"));

    expect(journal?.patient.lastVisit).toBe("-");
  });

  it("flags a patient viewer looking at their own journal", async () => {
    findUnique.mockResolvedValue(patientRow());

    const journal = await getDatabasePatientJournal(1, viewer("patient", { id: 4, patientId: 1 }));

    expect(journal?.isOwnJournal).toBe(true);
    expect(journal?.viewerRole).toBe("patient");
    expect(journal?.viewerUserId).toBe(4);
  });

  it("does not flag a staff viewer as viewing their own journal", async () => {
    findUnique.mockResolvedValue(patientRow());

    expect((await getDatabasePatientJournal(1, viewer("nurse", { id: 2 })))?.isOwnJournal).toBe(
      false,
    );
  });
});

describe("getDatabasePatientJournal note visibility", () => {
  const mixedNotes = [
    note({ id: 1, visibility: "all", authorId: 2 }),
    note({ id: 2, visibility: "healthcare", authorId: 2 }),
    note({ id: 3, visibility: "private", authorId: 1 }),
    note({ id: 4, visibility: "private", authorId: 2 }),
  ];

  function journalWith(notes: ReturnType<typeof note>[]) {
    findUnique.mockResolvedValue(
      patientRow({
        records: [
          {
            id: 1,
            recordType: "diagnosis",
            content: "Mild asthma.",
            createdAt: new Date("2026-08-18T00:00:00.000Z"),
            author: { id: 1, username: "dr_test" },
            notes,
          },
        ],
      }),
    );
  }

  it("shows staff every note except other authors' private ones", async () => {
    journalWith(mixedNotes);

    const journal = await getDatabasePatientJournal(1, viewer("doctor", { id: 1 }));

    expect(journal?.notes.map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(journal?.hiddenNotesCount).toBe(1);
  });

  it("shows a patient only the notes marked for everyone", async () => {
    journalWith(mixedNotes);

    const journal = await getDatabasePatientJournal(1, viewer("patient", { id: 4, patientId: 1 }));

    expect(journal?.notes.map((entry) => entry.id)).toEqual([1]);
    expect(journal?.hiddenNotesCount).toBe(3);
  });

  it("keeps another author's private note hidden from a nurse", async () => {
    journalWith(mixedNotes);

    const journal = await getDatabasePatientJournal(1, viewer("nurse", { id: 2 }));

    expect(journal?.notes.map((entry) => entry.id)).toEqual([1, 2, 4]);
    expect(journal?.hiddenNotesCount).toBe(1);
  });

  it("maps a visible note onto the journal preview shape", async () => {
    journalWith([note({ id: 1, visibility: "all", authorId: 2 })]);

    const journal = await getDatabasePatientJournal(1, viewer("doctor"));

    expect(journal?.notes[0]).toEqual({
      id: 1,
      createdAt: "2026-08-18T10:42:00.000Z",
      author: "dr_test",
      authorUserId: 2,
      visibility: "all",
      text: "note",
    });
  });

  it("leaves accessLogs empty for the journal payload", async () => {
    findUnique.mockResolvedValue(patientRow());

    expect((await getDatabasePatientJournal(1, viewer("doctor")))?.accessLogs).toEqual([]);
  });
});
