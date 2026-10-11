import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * search.ts builds a Prisma `where` clause and paginates. These tests assert
 * the query it hands to Prisma (the part that encodes the search rules) while
 * returning canned rows, so the SQL itself stays covered by the Playwright
 * specs against a real Postgres.
 */

const findMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (db: unknown) => Promise<unknown>) =>
      callback({ patient: { findMany, count } }),
  },
}));

const { searchDatabasePatients } = await import("@/lib/patients/search");

type FindManyArgs = {
  where: Record<string, unknown>;
  orderBy: unknown;
  skip: number;
  take: number;
  select: Record<string, unknown>;
};

function lastFindManyArgs(): FindManyArgs {
  const call = findMany.mock.calls.at(-1);
  if (!call) throw new Error("findMany was never called");
  return call[0] as FindManyArgs;
}

const patientRow = {
  id: 1,
  firstName: "Anna",
  lastName: "Kowalska",
  dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
  personalNumber: "199001011234",
  records: [{ createdAt: new Date("2026-08-18T00:00:00.000Z"), _count: { notes: 3 } }],
};

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([patientRow]);
  count.mockReset().mockResolvedValue(1);
});

describe("searchDatabasePatients query building", () => {
  it("matches every whitespace-separated word against first or last name", async () => {
    await searchDatabasePatients("anna kowalska", ["name"], 1, 1);

    const { where } = lastFindManyArgs();
    expect(where.OR).toEqual([
      {
        AND: [
          {
            OR: [
              { firstName: { contains: "anna", mode: "insensitive" } },
              { lastName: { contains: "anna", mode: "insensitive" } },
            ],
          },
          {
            OR: [
              { firstName: { contains: "kowalska", mode: "insensitive" } },
              { lastName: { contains: "kowalska", mode: "insensitive" } },
            ],
          },
        ],
      },
    ]);
  });

  it("collapses repeated whitespace", async () => {
    await searchDatabasePatients("  anna   kowalska  ", ["name"], 1, 1);

    const conditions = lastFindManyArgs().where.OR as Array<{ AND: unknown[] }>;
    expect(conditions[0]?.AND).toHaveLength(2);
  });

  it("searches Polish characters case-insensitively through the insensitive mode", async () => {
    await searchDatabasePatients("Łukasz Żółkiewski", ["name"], 1, 1);

    const conditions = lastFindManyArgs().where.OR as Array<{ AND: Array<{ OR: unknown[] }> }>;
    expect(JSON.stringify(conditions)).toContain("Łukasz");
    expect(JSON.stringify(conditions)).toContain("Żółkiewski");
    expect(JSON.stringify(conditions)).toContain("insensitive");
  });

  it("strips spaces and dashes from a personal-number query", async () => {
    await searchDatabasePatients("19900101-1234", ["personalNumber"], 1, 1);

    expect(lastFindManyArgs().where.OR).toEqual([{ personalNumber: { contains: "199001011234" } }]);
  });

  it("ignores a personal-number query that is not all digits", async () => {
    await searchDatabasePatients("abc123", ["personalNumber"], 1, 1);

    expect(lastFindManyArgs().where.OR).toEqual([{ id: -1 }]);
  });

  it("expands a bare year to a full-year date range", async () => {
    await searchDatabasePatients("1990", ["dob"], 1, 1);

    expect(lastFindManyArgs().where.OR).toEqual([
      {
        dateOfBirth: {
          gte: new Date("1990-01-01T00:00:00.000Z"),
          lt: new Date("1991-01-01T00:00:00.000Z"),
        },
      },
    ]);
  });

  it("expands a year-month to the next month", async () => {
    await searchDatabasePatients("1990-03", ["dob"], 1, 1);

    expect(lastFindManyArgs().where.OR).toEqual([
      {
        dateOfBirth: {
          gte: new Date("1990-03-01T00:00:00.000Z"),
          lt: new Date("1990-04-01T00:00:00.000Z"),
        },
      },
    ]);
  });

  it("expands a full date to the next day", async () => {
    await searchDatabasePatients("1990-03-15", ["dob"], 1, 1);

    expect(lastFindManyArgs().where.OR).toEqual([
      {
        dateOfBirth: {
          gte: new Date("1990-03-15T00:00:00.000Z"),
          lt: new Date("1990-03-16T00:00:00.000Z"),
        },
      },
    ]);
  });

  it.each(["199", "999-13-01", "1990-02-30", "not-a-date"])(
    "ignores the impossible date %s",
    async (query) => {
      await searchDatabasePatients(query, ["dob"], 1, 1);

      expect(lastFindManyArgs().where.OR).toEqual([{ id: -1 }]);
    },
  );

  it("ANDs the active filters together", async () => {
    await searchDatabasePatients("1990", ["name", "dob", "personalNumber"], 1, 1);

    expect(lastFindManyArgs().where.OR).toHaveLength(3);
  });

  it("does not constrain results for an empty query", async () => {
    await searchDatabasePatients("", ["name"], 1, 1);

    expect(lastFindManyArgs().where).toEqual({});
  });
});

describe("searchDatabasePatients pagination", () => {
  it("orders by last name, then first name, then id for stable paging", async () => {
    await searchDatabasePatients("", ["name"], 1, 1);

    expect(lastFindManyArgs().orderBy).toEqual([
      { lastName: "asc" },
      { firstName: "asc" },
      { id: "asc" },
    ]);
  });

  it("uses a page size of 3", async () => {
    const result = await searchDatabasePatients("", ["name"], 1, 1);

    expect(lastFindManyArgs().take).toBe(3);
    expect(result.pageSize).toBe(3);
  });

  it("clamps a page beyond the end to the last page", async () => {
    count.mockResolvedValue(7);

    const result = await searchDatabasePatients("", ["name"], 99, 1);

    expect(result).toMatchObject({ total: 7, totalPages: 3, page: 3 });
    expect(lastFindManyArgs().skip).toBe(6);
  });

  it("reports one page when nothing matches", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const result = await searchDatabasePatients("zzz", ["name"], 5, 1);

    expect(result).toMatchObject({ total: 0, totalPages: 1, page: 1, patients: [] });
    expect(lastFindManyArgs().skip).toBe(0);
  });

  it("computes the skip from the requested page", async () => {
    count.mockResolvedValue(30);

    await searchDatabasePatients("", ["name"], 2, 1);

    expect(lastFindManyArgs().skip).toBe(3);
  });
});

describe("searchDatabasePatients row mapping", () => {
  it("joins the name and formats dates as YYYY-MM-DD", async () => {
    const [patient] = (await searchDatabasePatients("", ["name"], 1, 1)).patients;

    expect(patient).toMatchObject({
      id: 1,
      name: "Anna Kowalska",
      dateOfBirth: "1990-01-01",
      personalNumber: "199001011234",
      recordCount: 1,
      noteCount: 3,
      lastVisit: "2026-08-18",
    });
  });

  it("uses '-' as lastVisit for a patient with no records", async () => {
    findMany.mockResolvedValue([{ ...patientRow, records: [] }]);

    const [patient] = (await searchDatabasePatients("", ["name"], 1, 1)).patients;

    expect(patient).toMatchObject({ recordCount: 0, noteCount: 0, lastVisit: "-" });
  });

  it("counts notes the viewer is allowed to see by passing their id into the query", async () => {
    await searchDatabasePatients("", ["name"], 1, 4);

    const noteCountFilter = JSON.stringify(lastFindManyArgs().select);
    expect(noteCountFilter).toContain("visibility");
    expect(noteCountFilter).toContain("healthcare");
    expect(noteCountFilter).toContain("authorId");
  });
});
