// filepath: extension/src/adapters/dom/mutation-observer-dom-port.ts
/**
 * Real DomPort over the platform MutationObserver. The DetectEngine role is
 * the only caller allowed to `observe` — one live observer per page is a
 * gate (G3/G5), and this adapter is where that budget physically lives:
 * ONE platform MutationObserver per DomPort instance multiplexes every
 * subscription, narrowing batches per subscriber at dispatch time.
 */
import type { DomPort } from '../../contracts/ports';
import type { Unsubscribe } from '../../bus/event-bus';

type MutationCallback = (mutations: MutationRecord[]) => void;

/**
 * The single real observer always watches the widest surface: attributeFilter
 * is deliberately omitted so every attribute record flows into dispatch,
 * where each subscription's own filter decides. characterData is included so
 * title-style subscriptions (RouteWatcher's <title> fallback) still see
 * Text-node data changes; subscriptions that don't ask for characterData
 * never receive characterData-only batches. Per-subscription record
 * narrowing is out of scope — subscribers receive the full batch and filter
 * records themselves (engines already do).
 */
const SUPERSET_INIT: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
};

interface Subscription {
  options: MutationObserverInit;
  callback: MutationCallback;
}

/**
 * Multiplexer match rule: does `mutations` contain at least one record this
 * subscription asked for? A subscription that names no record kind (no
 * childList/attributes/characterData) matches every batch.
 */
function batchMatches(options: MutationObserverInit, mutations: MutationRecord[]): boolean {
  const wantsChildList = options.childList === true;
  const wantsAttributes = options.attributes === true;
  const wantsCharacterData = options.characterData === true;
  if (!wantsChildList && !wantsAttributes && !wantsCharacterData) return true;

  const attributeFilter = Array.isArray(options.attributeFilter) ? options.attributeFilter : null;
  return mutations.some((record) => {
    if (record.type === 'childList') return wantsChildList;
    if (record.type === 'attributes') {
      if (!wantsAttributes) return false;
      if (!attributeFilter) return true;
      return record.attributeName !== null && attributeFilter.includes(record.attributeName);
    }
    if (record.type === 'characterData') return wantsCharacterData;
    return false;
  });
}

export class MutationObserverDomPort implements DomPort {
  readonly document: Document;

  private readonly subscriptions = new Map<number, Subscription>();
  private observer: MutationObserver | null = null;
  private nextId = 1;
  private disposedSinceLastObserve = false;
  private createdObservers = 0;

  constructor(document: Document = window.document) {
    this.document = document;
  }

  /** Live subscription count — S10 qa probe hook. */
  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  /** True between dispose() and the next observe() that revives the port. */
  get disposed(): boolean {
    return this.disposedSinceLastObserve;
  }

  /**
   * Monotonic count of platform MutationObservers this instance constructed.
   * A healthy page stays at 1 for its whole life: the multiplexer reuses one
   * observer across subscribe/unsubscribe cycles; only an owner dispose()
   * followed by a revival constructs another.
   */
  get observerCreatedCount(): number {
    return this.createdObservers;
  }

  querySelectorAll<T extends Element = Element>(selector: string, root?: ParentNode): T[] {
    const scope = root ?? this.document;
    return Array.from(scope.querySelectorAll<T>(selector));
  }

  observe(options: MutationObserverInit, callback: MutationCallback): Unsubscribe {
    this.disposedSinceLastObserve = false;
    const id = this.nextId++;
    this.subscriptions.set(id, { options, callback });
    // Idempotent on the platform: re-observing the same target just refreshes.
    this.ensureObserver().observe(this.document, SUPERSET_INIT);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (!this.subscriptions.delete(id)) return; // already gone (e.g. dispose)
      if (this.subscriptions.size === 0) this.observer?.disconnect();
    };
  }

  /** Owner teardown: disconnect the real observer and drop every subscription. */
  dispose(): void {
    this.disposedSinceLastObserve = true;
    this.subscriptions.clear();
    this.observer?.disconnect();
    this.observer = null;
  }

  private ensureObserver(): MutationObserver {
    if (!this.observer) {
      this.createdObservers += 1;
      this.observer = new MutationObserver((mutations) => this.dispatch(mutations));
    }
    return this.observer;
  }

  private dispatch(mutations: MutationRecord[]): void {
    for (const subscription of this.subscriptions.values()) {
      if (!batchMatches(subscription.options, mutations)) continue;
      // Fault isolation: one broken subscriber must never starve the others
      // in the batch (the pre-S10 per-feature observers were isolated by
      // construction). Swallow with a prefixed warn, matching the
      // [CQD …] logging idiom; the subscription stays live for later batches.
      try {
        subscription.callback(mutations);
      } catch (error) {
        console.warn('[CQD DomPort] subscription callback threw:', error);
      }
    }
  }
}

export function createMutationObserverDomPort(document: Document): DomPort {
  return new MutationObserverDomPort(document);
}

/**
 * Additive debug surface for the qa-08 single-observer journey (extension
 * world only — content scripts run isolated, so the page's main world never
 * sees this). Getter-shaped, so every read is current at
 * subscribe/unsubscribe/dispose time without the port pushing updates.
 */
export interface CqdDomPortDebugInfo {
  subscriptionCount: () => number;
  observerCreatedCount: () => number;
  disposed: () => boolean;
}

/**
 * Per-PAGE singleton: S10's separate content-script entries must share one
 * DomPort (hence one platform observer) per page. Anchored on window so
 * independently-evaluated module copies still converge on the same instance.
 * Also registers `window.__cqdDomPortInfo` once, over that same instance.
 */
export function getPageDomPort(): MutationObserverDomPort {
  const host = window as unknown as {
    __cqdDomPort?: MutationObserverDomPort;
    __cqdDomPortInfo?: CqdDomPortDebugInfo;
  };
  const port = (host.__cqdDomPort ??= new MutationObserverDomPort());
  host.__cqdDomPortInfo ??= {
    subscriptionCount: () => port.subscriptionCount,
    observerCreatedCount: () => port.observerCreatedCount,
    disposed: () => port.disposed,
  };
  return port;
}
