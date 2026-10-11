import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `verifyLocalOutbox` is the tamper signal the project claims, so the mismatch
 * case is the one that has to be right: a dropped, reordered, or edited local
 * entry has to produce `match: false`.
 */

const findMany = vi.fn();
const prisma = vi.hoisted(() => ({
  accessLog: { findMany: (...args: unknown[]) => findMany(...args) },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

const fetchCurrentHead = vi.fn();
vi.mock("@/lib/solana/chain", () => ({ fetchCurrentHead }));

const { verifyLocalOutbox } = await import("@/lib/outbox/verify");
const { foldHead, toHex } = await import("@/lib/solana/hash");
const { toChainEvent } = await import("@/lib/outbox/store");

type Row = Parameters<typeof toChainEvent>[0];

function rows(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index + 1,
    eventId: `e-${index + 1}`,
    patientId: 1,
    userId: 2,
    recordId: index + 1,
    action: "view",
    serverId: "hospital-s",
    clientTime: new Date(1_700_000_000_000),
    attempt: 0,
    // `user.role` is what the route reads; `role` is what toChainEvent wants.
    role: "doctor",
    user: { role: "doctor" },
  }));
}

/** The chain events the production code would fold for these rows. */
function chainEvents(rowsFromDb: ReturnType<typeof rows>) {
  return rowsFromDb.map((row) => toChainEvent({ ...row } satisfies Row));
}

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  fetchCurrentHead.mockReset().mockResolvedValue(new Uint8Array(32));
});

describe("verifyLocalOutbox", () => {
  it("reads every row in id order, not just the anchored ones", async () => {
    await verifyLocalOutbox();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: "asc" } }));
  });

  it("matches when the local fold equals the chain head", async () => {
    const local = rows(3);
    findMany.mockResolvedValue(local);
    fetchCurrentHead.mockResolvedValue(foldHead(chainEvents(local)));

    const result = await verifyLocalOutbox();

    expect(result.match).toBe(true);
    expect(result.localHead).toBe(result.chainHead);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("matches an empty mirror against an empty chain", async () => {
    const result = await verifyLocalOutbox();

    expect(result.match).toBe(true);
    expect(result.localHead).toBe(toHex(new Uint8Array(32)));
  });

  it("reports a mismatch when an entry is dropped from the mirror", async () => {
    const anchored = rows(3);
    fetchCurrentHead.mockResolvedValue(foldHead(chainEvents(anchored)));
    findMany.mockResolvedValue(anchored.slice(0, 2));

    const result = await verifyLocalOutbox();

    expect(result.match).toBe(false);
  });

  it("reports a mismatch when an entry is reordered", async () => {
    const anchored = rows(3);
    fetchCurrentHead.mockResolvedValue(foldHead(chainEvents(anchored)));
    const [first, second, third] = anchored;
    findMany.mockResolvedValue([first, third, second]);

    const result = await verifyLocalOutbox();

    expect(result.match).toBe(false);
  });

  it("reports a mismatch when an entry is edited in place", async () => {
    const anchored = rows(2);
    fetchCurrentHead.mockResolvedValue(foldHead(chainEvents(anchored)));
    findMany.mockResolvedValue([anchored[0], { ...anchored[1], action: "delete" }]);

    const result = await verifyLocalOutbox();

    expect(result.match).toBe(false);
  });

  it("includes a pending row, so an unanchored event reads as unverified", async () => {
    const anchored = rows(1);
    fetchCurrentHead.mockResolvedValue(foldHead(chainEvents(anchored)));
    findMany.mockResolvedValue([...anchored, rows(1)[0]!]);

    const result = await verifyLocalOutbox();

    expect(result.match).toBe(false);
  });
});
