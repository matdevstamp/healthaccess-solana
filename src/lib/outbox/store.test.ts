import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaOutboxStore, toChainEvent, type OutboxEntry } from "@/lib/outbox/store";
import { hashActorId, hashPatientId } from "@/lib/solana/hash";
import { NO_RECORD, actionToCode, roleToCode } from "@/lib/solana/types";

/**
 * `toChainEvent` is the GDPR boundary: it is the last point at which a raw
 * patient or user id exists, and the first point at which the payload is safe
 * to put on a public ledger. The Prisma store is exercised against a mock so
 * these stay unit tests.
 */

// `vi.mock` is hoisted above the imports, so the stub has to be too.
const prisma = vi.hoisted(() => ({
  accessLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

const { prismaOutboxStore: store } = await import("@/lib/outbox/store");

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 1,
    eventId: "e-1",
    patientId: 4,
    userId: 9,
    role: "nurse",
    action: "view",
    recordId: 77,
    serverId: "hospital-s",
    clientTime: new Date(1_700_000_000_000),
    attempt: 0,
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    eventId: "e-1",
    patientId: 4,
    userId: 9,
    recordId: 77,
    action: "view",
    serverId: "hospital-s",
    clientTime: new Date(1_700_000_000_000),
    attempt: 0,
    status: "pending",
    user: { role: "nurse" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toChainEvent", () => {
  it("hashes both ids instead of carrying them", () => {
    const event = toChainEvent(entry());

    expect(event.patientHash).toEqual(hashPatientId(4));
    expect(event.actorHash).toEqual(hashActorId(9));
  });

  it("maps the action and role onto the wire enums", () => {
    const event = toChainEvent(entry({ action: "created_note", role: "ambulance" }));

    expect(event.action).toBe(actionToCode("created_note"));
    expect(event.role).toBe(roleToCode("ambulance"));
  });

  it("maps a denied access onto the audit event the contract defines", () => {
    const event = toChainEvent(entry({ action: "view_denied", role: "unauthorized" }));

    expect(event.action).toBe(4);
    expect(event.role).toBe(5);
  });

  it("keeps the record id a bigint and uses -1 for none", () => {
    expect(toChainEvent(entry({ recordId: 77 })).recordId).toBe(77n);
    expect(toChainEvent(entry({ recordId: null })).recordId).toBe(NO_RECORD);
  });

  it("takes the timestamp in seconds, not milliseconds", () => {
    expect(toChainEvent(entry()).timestamp).toBe(1_700_000_000n);
  });

  it("maps the server id to the wire index", () => {
    expect(toChainEvent(entry({ serverId: "hospital-s" })).server).toBe(0);
    expect(toChainEvent(entry({ serverId: "ambulance-a" })).server).toBe(1);
  });
});

describe("prismaOutboxStore.enqueue", () => {
  it("writes the row as pending with no attempt or signature yet", async () => {
    prisma.accessLog.create.mockResolvedValue({ id: 3 });

    await expect(
      store.enqueue({
        eventId: "e-9",
        patientId: 1,
        userId: 2,
        recordId: null,
        action: "view",
        serverId: "hospital-s",
      }),
    ).resolves.toEqual({ id: 3 });

    expect(prisma.accessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: "e-9", status: "pending", recordId: null }),
      }),
    );
  });
});

describe("prismaOutboxStore.pending", () => {
  it("takes the oldest pending rows in id order", async () => {
    prisma.accessLog.findMany.mockResolvedValue([row()]);

    const rows = await store.pending(5);

    expect(prisma.accessLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pending" },
        orderBy: { id: "asc" },
        take: 5,
      }),
    );
    expect(rows[0]).toMatchObject({ id: 1, role: "nurse", recordId: 77 });
  });

  it("synthesizes an eventId for a row written before the column existed", async () => {
    prisma.accessLog.findMany.mockResolvedValue([row({ eventId: null })]);

    const rows = await store.pending(5);

    expect(rows[0]?.eventId).toBe("row-1");
  });
});

describe("prismaOutboxStore.claim", () => {
  it("claims with a compare-and-swap that increments the attempt", async () => {
    prisma.accessLog.updateMany.mockResolvedValue({ count: 1 });
    prisma.accessLog.findUnique.mockResolvedValue(row({ status: "flushing", attempt: 1 }));

    await store.claim(1);

    expect(prisma.accessLog.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "pending" },
      data: expect.objectContaining({ status: "flushing", attempt: { increment: 1 } }),
    });
  });

  it("returns null when another worker already owns the row", async () => {
    prisma.accessLog.updateMany.mockResolvedValue({ count: 0 });

    await expect(store.claim(1)).resolves.toBeNull();
    expect(prisma.accessLog.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the row vanished between claim and read", async () => {
    prisma.accessLog.updateMany.mockResolvedValue({ count: 1 });
    prisma.accessLog.findUnique.mockResolvedValue(null);

    await expect(store.claim(1)).resolves.toBeNull();
  });
});

describe("prismaOutboxStore terminal writes", () => {
  it("stores the signature, slot and head hash on success", async () => {
    prisma.accessLog.update.mockResolvedValue({});

    await store.markAnchored(1, { signature: "sig", slot: 123n, headHash: "ff" });

    expect(prisma.accessLog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "anchored", signature: "sig", slot: 123n, headHash: "ff", error: null },
    });
  });

  it("returns a retryable row to pending with its attempt and error", async () => {
    prisma.accessLog.update.mockResolvedValue({});

    await store.markRetry(1, 3, "rpc timeout");

    expect(prisma.accessLog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "pending", attempt: 3, error: "rpc timeout" },
    });
  });

  it("parks a terminal row as failed", async () => {
    prisma.accessLog.update.mockResolvedValue({});

    await store.markFailed(1, 1, "unauthorized signer");

    expect(prisma.accessLog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "failed", attempt: 1, error: "unauthorized signer" },
    });
  });

  it("counts only pending rows", async () => {
    prisma.accessLog.count.mockResolvedValue(4);

    await expect(store.countPending()).resolves.toBe(4);
    expect(prisma.accessLog.count).toHaveBeenCalledWith({ where: { status: "pending" } });
  });
});

describe("prismaOutboxStore.recoverStaleClaims", () => {
  it("returns long-abandoned flushing rows to pending", async () => {
    prisma.accessLog.updateMany.mockResolvedValue({ count: 2 });
    const cutoff = new Date(0);

    await expect(store.recoverStaleClaims(cutoff)).resolves.toBe(2);

    expect(prisma.accessLog.updateMany).toHaveBeenCalledWith({
      where: { status: "flushing", claimedAt: { lt: cutoff } },
      data: { status: "pending" },
    });
  });
});

describe("store export", () => {
  it("exposes the same object it was imported as", () => {
    expect(store).toBe(prismaOutboxStore);
  });
});
