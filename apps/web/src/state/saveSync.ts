// Save Card sync decisions, kept free of storage, network and stores so they can be unit tested.
//
// Every upload the server accepts bumps the card's `rev`. A device remembers the rev it last synced from or to,
// and sends it as `baseRev`; if another device uploaded in between, the server answers 409. Before this device
// uploads for the first time after starting (and after any 409) it downloads the card, decrypts it on the device
// and calls decideSync() to choose what to do. Nothing new leaves the device: the comparison happens here.

/** What this device knows, all local. */
export interface LocalSide {
  /** Rev of the card this device last synced from or to. Undefined on cards made before revs existed. */
  rev: number | undefined;
  /** Hash of the snapshot the server last accepted from (or gave to) this device. */
  lastHash: string | undefined;
  /** Hash of this device's snapshot right now. */
  currentHash: string;
}

/** The server copy, after downloading and decrypting it. Null when the server has no such card (404). */
export interface ServerSide {
  rev: number;
  /** Hash of the decrypted snapshot's keys, computed the same way as LocalSide.currentHash. */
  hash: string;
}

export type SyncDecision =
  /** Both sides already hold the same progress: just remember the server's rev. */
  | { action: 'in-sync'; rev: number }
  /** The server has nothing this device lacks: upload, based on the server's rev (0 = make the card again). */
  | { action: 'push'; baseRev: number }
  /** The server has progress this device has not seen: stop uploading and ask the player. */
  | { action: 'ask'; rev: number };

export function decideSync(local: LocalSide, server: ServerSide | null): SyncDecision {
  // Gone from the server (removed on another device, or expired): store this device's progress again.
  if (!server) return { action: 'push', baseRev: 0 };
  // Same progress on both sides, whatever the revs say.
  if (server.hash === local.currentHash) return { action: 'in-sync', rev: server.rev };
  // The server still holds what this device last synced: nothing newer arrived from elsewhere.
  if (server.rev === local.rev || (local.lastHash !== undefined && server.hash === local.lastHash)) {
    return { action: 'push', baseRev: server.rev };
  }
  // Different progress that this device never saw (newer, or from a card made again elsewhere).
  return { action: 'ask', rev: server.rev };
}

/** Consecutive 409s handled automatically before giving up until the normal retry backoff. Prevents loops. */
export const MAX_CONFLICT_RETRIES = 2;

// ---------------------------------------------------------------------------------------------
// Summaries, so the player can tell two saves apart

export interface SaveSummary {
  handle: string | null;
  /** Lifetime Stars earned (falls back to the current Stars on older saves). */
  stars: number | null;
  missions: number | null;
}

/** Reads a few numbers out of a snapshot's stored JSON. Never throws. */
export function summarize(keys: Record<string, string>): SaveSummary {
  const read = <T>(key: string, pick: (state: Record<string, unknown>) => T): T | null => {
    try {
      const v = keys[key];
      return v ? pick((JSON.parse(v) as { state: Record<string, unknown> }).state) : null;
    } catch {
      return null;
    }
  };
  const rewards = read(
    'sq.rewards.v1',
    (st) => st.rewards as { handle?: unknown; stars?: unknown; starsEarned?: unknown } | undefined,
  );
  const progress = read('sq.progress.v1', (st) => st.progress as { completedCount?: unknown } | undefined);
  const stars =
    typeof rewards?.starsEarned === 'number'
      ? rewards.starsEarned
      : typeof rewards?.stars === 'number'
        ? rewards.stars
        : null;
  return {
    handle: typeof rewards?.handle === 'string' ? rewards.handle : null,
    stars,
    missions: typeof progress?.completedCount === 'number' ? progress.completedCount : null,
  };
}
