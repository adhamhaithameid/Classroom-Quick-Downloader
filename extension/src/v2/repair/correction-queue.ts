// filepath: extension/src/v2/repair/correction-queue.ts
/**
 * ============================================================================
 * CORRECTION QUEUE — Priority Queue with Backoff + Dedup
 * ============================================================================
 *
 * When the deep validator finds a divergence between the model and
 * the DOM, it creates a CorrectionItem. This queue collects those
 * items and processes them in idle slices.
 *
 * Key design decisions:
 * 1. Priority ordering — CRITICAL > HIGH > MEDIUM > LOW
 * 2. Dedup — same element can't have two pending corrections
 * 3. Backoff — after 3 failed corrections in 10s, mark as unstable
 * 4. Ring buffer — keep last 50 corrections for debugging
 * 5. Flush — on destroy or route transition, cancel everything
 *
 * Processing model:
 * - Queue collects items during validation
 * - process() is called in requestIdleCallback
 * - Each correction calls the appropriate repair function
 * - If repair fails (element removed, etc.), item is retried with backoff
 *
 * @author Adham — this prevents the infinite DOM-fight loops from V1
 * @since v4.0.0
 */

import type {
  CorrectionItem,
  CorrectionPriority,
  CorrectionOp,
} from './deep-validator';
import { recordCorrection, isUnstable } from './deep-validator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function for processing a correction.
 * Returns true if correction was successful, false to retry.
 */
export type CorrectionHandler = (item: CorrectionItem) => boolean;

/**
 * Record of a completed correction (for the history ring buffer).
 */
export interface CorrectionRecord {
  item: CorrectionItem;
  success: boolean;
  processedAt: number;
  duration_ms: number;
}

/**
 * Queue statistics for debugging.
 */
export interface QueueStats {
  pending: number;
  processed: number;
  failed: number;
  unstableSkipped: number;
  historySize: number;
  byPriority: Record<CorrectionPriority, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum items in the history ring buffer */
const MAX_HISTORY = 50;

/** Priority ordering for sorting */
const PRIORITY_ORDER: Record<CorrectionPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Minimum idle time remaining to process another item (ms) */
const MIN_IDLE_TIME_MS = 2;

// ============================================================================
// CORRECTION QUEUE CLASS
// ============================================================================

export class CorrectionQueue {
  /** Pending corrections, sorted by priority */
  private queue: CorrectionItem[] = [];

  /** Map of item.id → item for dedup */
  private pendingById: Map<string, CorrectionItem> = new Map();

  /** Completed correction history (ring buffer) */
  private history: CorrectionRecord[] = [];

  /** Handler to call for each correction */
  private handler: CorrectionHandler | null = null;

  /** Stats */
  private processedCount = 0;
  private failedCount = 0;
  private unstableSkippedCount = 0;

  /** requestIdleCallback ID for pending processing */
  private idleCallbackId: number | null = null;

  /** Whether the queue is actively processing */
  private processing = false;

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Register the correction handler.
   * There's only one handler — the engine's repair function.
   */
  setHandler(handler: CorrectionHandler): void {
    this.handler = handler;
  }

  /**
   * Enqueue a correction item.
   *
   * Dedup: if the same item.id is already queued, update its priority
   * to the HIGHER of the two (lower ordinal = higher priority).
   */
  enqueue(item: CorrectionItem): void {
    // Skip if element is unstable
    if (isUnstable(item.id)) {
      this.unstableSkippedCount++;
      return;
    }

    // Dedup check
    const existing = this.pendingById.get(item.id);
    if (existing) {
      // Update to higher priority
      if (PRIORITY_ORDER[item.priority] < PRIORITY_ORDER[existing.priority]) {
        existing.priority = item.priority;
        existing.reason = item.reason;
        this._resort();
      }
      return;
    }

    // Add to queue
    this.queue.push(item);
    this.pendingById.set(item.id, item);
    this._resort();
  }

  /**
   * Enqueue multiple correction items.
   */
  enqueueAll(items: CorrectionItem[]): void {
    for (const item of items) {
      this.enqueue(item);
    }
  }

  /**
   * Process corrections in an idle slice.
   *
   * @param timeRemaining - Function returning ms left (from IdleDeadline or mock)
   * @returns Number of corrections processed in this slice
   */
  process(timeRemaining?: () => number): number {
    if (!this.handler || this.queue.length === 0) return 0;

    this.processing = true;
    let processed = 0;

    while (this.queue.length > 0) {
      // Check idle deadline
      if (timeRemaining && timeRemaining() < MIN_IDLE_TIME_MS) {
        break;
      }

      const item = this.queue.shift()!;
      this.pendingById.delete(item.id);

      // Skip if element became unstable since enqueue
      if (isUnstable(item.id)) {
        this.unstableSkippedCount++;
        continue;
      }

      // Skip if element is no longer connected
      if (!item.element.isConnected) {
        continue;
      }

      // Process the correction
      const startTime = performance.now();
      let success = false;

      try {
        success = this.handler(item);
      } catch (err) {
        console.warn(`[CorrectionQueue] Handler failed for ${item.id}:`, err);
        success = false;
      }

      const elapsed = performance.now() - startTime;

      // Record in history
      this._addHistory({
        item,
        success,
        processedAt: Date.now(),
        duration_ms: elapsed,
      });

      if (success) {
        this.processedCount++;
      } else {
        this.failedCount++;

        // Record the correction attempt for backoff tracking
        const isNowUnstable = recordCorrection(item.id);

        if (!isNowUnstable) {
          // Re-enqueue with incremented retry count and downgraded priority
          const retry: CorrectionItem = {
            ...item,
            retryCount: item.retryCount + 1,
            priority: this._downgradePriority(item.priority),
          };
          this.enqueue(retry);
        } else {
          this.unstableSkippedCount++;
        }
      }

      processed++;
    }

    this.processing = false;
    return processed;
  }

  /**
   * Schedule processing via requestIdleCallback.
   * Safe to call multiple times — deduplicates.
   */
  scheduleProcessing(): void {
    if (this.idleCallbackId !== null) return;
    if (this.queue.length === 0) return;

    if (typeof requestIdleCallback === 'function') {
      this.idleCallbackId = requestIdleCallback((deadline) => {
        this.idleCallbackId = null;
        this.process(() => deadline.timeRemaining());

        // Re-schedule if there are more items
        if (this.queue.length > 0) {
          this.scheduleProcessing();
        }
      });
    } else {
      // Fallback for environments without requestIdleCallback (e.g., jsdom)
      this.idleCallbackId = setTimeout(() => {
        this.idleCallbackId = null;
        this.process(() => 16); // Assume 16ms available
        if (this.queue.length > 0) {
          this.scheduleProcessing();
        }
      }, 0) as unknown as number;
    }
  }

  /**
   * Cancel all pending work and clear the queue.
   * Called on engine destroy or route transition.
   */
  flush(): void {
    this.queue = [];
    this.pendingById.clear();

    if (this.idleCallbackId !== null) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(this.idleCallbackId);
      } else {
        clearTimeout(this.idleCallbackId);
      }
      this.idleCallbackId = null;
    }

    this.processing = false;
  }

  /**
   * Get the number of pending corrections.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue has pending items.
   */
  get hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Get the highest priority item without removing it.
   */
  peek(): CorrectionItem | null {
    return this.queue[0] ?? null;
  }

  /**
   * Get queue statistics for debugging.
   */
  getStats(): QueueStats {
    const byPriority: Record<CorrectionPriority, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    for (const item of this.queue) {
      byPriority[item.priority]++;
    }

    return {
      pending: this.queue.length,
      processed: this.processedCount,
      failed: this.failedCount,
      unstableSkipped: this.unstableSkippedCount,
      historySize: this.history.length,
      byPriority,
    };
  }

  /**
   * Get correction history (most recent first).
   */
  getHistory(): readonly CorrectionRecord[] {
    return [...this.history].reverse();
  }

  /**
   * Reset all stats (but not the queue).
   * Used for testing.
   */
  resetStats(): void {
    this.processedCount = 0;
    this.failedCount = 0;
    this.unstableSkippedCount = 0;
    this.history = [];
  }

  // ========================================================================
  // INTERNAL
  // ========================================================================

  /** Sort queue by priority (lower ordinal = higher priority) */
  private _resort(): void {
    this.queue.sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  /** Add a record to the history ring buffer */
  private _addHistory(record: CorrectionRecord): void {
    this.history.push(record);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  /** Downgrade priority by one level (for retries) */
  private _downgradePriority(priority: CorrectionPriority): CorrectionPriority {
    switch (priority) {
      case 'CRITICAL': return 'HIGH';
      case 'HIGH': return 'MEDIUM';
      case 'MEDIUM': return 'LOW';
      case 'LOW': return 'LOW';
    }
  }
}
