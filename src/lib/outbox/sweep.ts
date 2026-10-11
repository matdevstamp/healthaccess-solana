import { env } from "@/lib/env";
import { prismaOutboxStore } from "@/lib/outbox/store";

/**
 * The periodic outbox sweep — task 32's answer to task 26's open question.
 *
 * Writes already schedule a flush, so the happy path needs nothing. The sweep
 * exists for the unhappy one: an event whose submit failed transiently while
 * the server then went idle. Without a sweep that row waits for the next
 * write, which may be never. "Pending events survive a restart" is only true
 * if something actually looks for them.
 *
 * It also covers the window before a deployment: events queued while
 * `SOLANA_PROGRAM_ID` was empty drain the moment the program becomes
 * configured.
 *
 * Follows the same `globalThis` guard as the peer heartbeat. Next bundles
 * instrumentation separately from route handlers, so a plain module singleton
 * would exist twice and run two sweeps against one queue.
 */

interface SweepStore {
  timer: NodeJS.Timeout | null;
  running: boolean;
  sweeps: number;
  lastSweptAt: string | null;
  lastError: string | null;
}

const STORE_KEY = Symbol.for("awesome-journal.outbox-sweep.store");

function getStore(): SweepStore {
  const holder = globalThis as typeof globalThis & { [STORE_KEY]?: SweepStore };

  if (!holder[STORE_KEY]) {
    holder[STORE_KEY] = {
      timer: null,
      running: false,
      sweeps: 0,
      lastSweptAt: null,
      lastError: null,
    };
  }

  return holder[STORE_KEY];
}

/**
 * How often to sweep.
 *
 * Ten seconds is demo-friendly: fast enough that a pending badge clears while
 * someone is looking at it, slow enough that devnet is not hammered. The flusher
 * skips a sweep when there is nothing pending, so an idle server costs one
 * indexed count per interval.
 */
export const SWEEP_INTERVAL_MS = 10_000;

/**
 * Is there anything worth a network round trip?
 *
 * Checked before loading the Solana SDK. With no `SOLANA_PROGRAM_ID` the answer
 * is always no, so the sweep costs nothing until the deploy lands.
 */
export async function hasPendingEvents(): Promise<boolean> {
  if (env.solanaProgramId.trim().length === 0) {
    return false;
  }
  return (await prismaOutboxStore.countPending()) > 0;
}

/** Run one sweep. Never throws; a failed sweep just runs again next tick. */
export async function sweepOutbox(): Promise<void> {
  const store = getStore();

  try {
    if (await hasPendingEvents()) {
      const { flushPending } = await import("@/lib/outbox/flusher");
      const { solanaSubmitter } = await import("@/lib/solana/submitter");
      const { getConnection } = await import("@/lib/solana/client");

      await flushPending({
        submitter: solanaSubmitter,
        store: prismaOutboxStore,
        resolveSlot: async (signature) => {
          const transaction = await getConnection().getTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });
          return transaction === null ? null : BigInt(transaction.slot);
        },
      });
    }

    store.sweeps += 1;
    store.lastSweptAt = new Date().toISOString();
    store.lastError = null;
  } catch (error) {
    store.lastError = error instanceof Error ? error.message : String(error);
  }
}

/** Start the sweep. Idempotent — safe to call from boot and from routes. */
export function startOutboxSweep(intervalMs: number = SWEEP_INTERVAL_MS): void {
  const store = getStore();

  if (store.running) {
    return;
  }

  store.running = true;
  void sweepOutbox();
  store.timer = setInterval(() => void sweepOutbox(), intervalMs);
  // Never hold the process open for a background sweep.
  store.timer.unref?.();
}

/** Stop the sweep (used by tests to avoid leaked timers). */
export function stopOutboxSweep(): void {
  const store = getStore();

  if (store.timer !== null) {
    clearInterval(store.timer);
    store.timer = null;
  }

  store.running = false;
}

export interface SweepStatus {
  running: boolean;
  sweeps: number;
  lastSweptAt: string | null;
  lastError: string | null;
}

export function getOutboxSweepStatus(): SweepStatus {
  const store = getStore();
  return {
    running: store.running,
    sweeps: store.sweeps,
    lastSweptAt: store.lastSweptAt,
    lastError: store.lastError,
  };
}
