import { createHash } from "node:crypto";

export type WorkerAdmission =
  | { accepted: true; queued: boolean; release: () => void }
  | { accepted: false; reason: "client-limit" | "queue-full" | "cancelled" };

type Waiter = {
  clientId: string;
  signal?: AbortSignal;
  resolve: (slot: WorkerAdmission) => void;
  onAbort?: () => void;
};

const activeByClient = new Map<string, number>();
const queue: Waiter[] = [];
let activeTotal = 0;

function configuredLimit(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

function limits() {
  return {
    global: configuredLimit("CAREER_OPS_WORKER_GLOBAL_LIMIT", 3, 32),
    perClient: configuredLimit("CAREER_OPS_WORKER_CLIENT_LIMIT", 2, 16),
    queue: configuredLimit("CAREER_OPS_WORKER_QUEUE_LIMIT", 12, 128),
  };
}

function activeFor(clientId: string): number {
  return activeByClient.get(clientId) ?? 0;
}

function allocate(clientId: string, queued: boolean): WorkerAdmission {
  activeTotal++;
  activeByClient.set(clientId, activeFor(clientId) + 1);
  let released = false;
  return {
    accepted: true,
    queued,
    release() {
      if (released) return;
      released = true;
      activeTotal--;
      const remaining = activeFor(clientId) - 1;
      if (remaining) activeByClient.set(clientId, remaining);
      else activeByClient.delete(clientId);
      drain();
    },
  };
}

function drain(): void {
  const { global, perClient } = limits();
  while (activeTotal < global && queue.length) {
    const index = queue.findIndex((waiter) => activeFor(waiter.clientId) < perClient);
    if (index < 0) return;
    const [waiter] = queue.splice(index, 1);
    waiter.signal?.removeEventListener("abort", waiter.onAbort!);
    waiter.resolve(allocate(waiter.clientId, true));
  }
}

/**
 * Admit one expensive child process. Busy clients and a full global queue fail
 * immediately; queued callers receive their slot FIFO as active workers finish.
 */
export function acquireWorkerSlot(clientId: string, options: { signal?: AbortSignal } = {}): Promise<WorkerAdmission> {
  const cleanClientId = clientId.trim() || "local";
  const { global, perClient, queue: queueLimit } = limits();
  const queuedForClient = queue.filter((waiter) => waiter.clientId === cleanClientId).length;
  if (options.signal?.aborted) return Promise.resolve({ accepted: false, reason: "cancelled" });
  if (activeFor(cleanClientId) + queuedForClient >= perClient) {
    return Promise.resolve({ accepted: false, reason: "client-limit" });
  }
  if (activeTotal < global && queue.length === 0) return Promise.resolve(allocate(cleanClientId, false));
  if (queue.length >= queueLimit) return Promise.resolve({ accepted: false, reason: "queue-full" });

  return new Promise((resolve) => {
    const waiter: Waiter = { clientId: cleanClientId, signal: options.signal, resolve };
    waiter.onAbort = () => {
      const index = queue.indexOf(waiter);
      if (index >= 0) queue.splice(index, 1);
      options.signal?.removeEventListener("abort", waiter.onAbort!);
      resolve({ accepted: false, reason: "cancelled" });
      drain();
    };
    options.signal?.addEventListener("abort", waiter.onAbort, { once: true });
    queue.push(waiter);
    drain();
  });
}

/** Derive a stable, non-secret admission key from the authenticated local session. */
export function workerClientId(request: Request): string {
  const session = request.headers.get("cookie")?.match(/(?:^|;\s*)career_ops_session=([^;]+)/)?.[1] || "local";
  return createHash("sha256").update(session).digest("hex").slice(0, 24);
}
