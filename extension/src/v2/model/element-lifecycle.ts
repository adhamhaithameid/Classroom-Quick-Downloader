// filepath: extension/src/v2/model/element-lifecycle.ts
/**
 * ============================================================================
 * ELEMENT LIFECYCLE OBSERVER — Connected/Disconnected Tracking
 * ============================================================================
 *
 * This is inspired by the qsa-observer library (https://github.com/nicolo-ribaudo/qsa-observer)
 * which I found while reading about efficient DOM observation patterns.
 *
 * The problem: MutationObserver tells you about added/removed NODES,
 * but it doesn't tell you about element CONNECTIONS. An element can be:
 * - Added to the DOM → "connected"
 * - Removed from the DOM → "disconnected"
 * - Moved within the DOM → "disconnected" then "connected" (same element!)
 *
 * We need to know about disconnections because when a post is removed
 * from the DOM, we need to:
 * 1. Clean up its WeakRef in the model
 * 2. Remove its download buttons and badges
 * 3. Free any event listeners
 *
 * The ElementLifecycleObserver watches for elements matching specific
 * selectors (like [data-stream-item-id]) and fires callbacks when
 * those elements are connected to or disconnected from the document.
 *
 * It's more efficient than checking element.isConnected on every scan
 * because it only fires when there's an actual DOM mutation, and it
 * does the selector matching in one batch.
 *
 * @author Adham — qsa-observer was a revelation, I just adapted the idea
 * @since v4.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Callback for element lifecycle events.
 *
 * @param element - The element that was connected/disconnected
 * @param event - Whether it was connected or disconnected
 * @param id - The element's identifier (from data-stream-item-id or similar)
 */
export type LifecycleCallback = (
  element: HTMLElement,
  event: 'connected' | 'disconnected',
  id: string | null,
) => void;

/**
 * Options for creating a lifecycle observer.
 */
export interface LifecycleObserverOptions {
  /** CSS selector to watch for (e.g., '[data-stream-item-id]') */
  selector: string;

  /** Optional: attribute to use as the element's identifier */
  idAttribute?: string;

  /** Callback when elements are connected or disconnected */
  callback: LifecycleCallback;

  /** Optional: root element to observe (default: document.body) */
  root?: HTMLElement;
}

// ============================================================================
// LIFECYCLE OBSERVER CLASS
// ============================================================================

/**
 * ElementLifecycleObserver — watches for element connections and disconnections.
 *
 * Usage:
 *   const lifecycle = new ElementLifecycleObserver({
 *     selector: '[data-stream-item-id]',
 *     idAttribute: 'data-stream-item-id',
 *     callback: (el, event, id) => {
 *       if (event === 'connected') console.log(`Post ${id} appeared!`);
 *       if (event === 'disconnected') console.log(`Post ${id} removed!`);
 *     },
 *   });
 *   lifecycle.start();
 *   // ... later ...
 *   lifecycle.stop();
 *
 * Internally it uses a MutationObserver on the root element,
 * and for each mutation batch, it checks which elements matching
 * the selector were added or removed.
 *
 * The "moved" case (element removed then re-added) is handled by
 * coalescing: we process all removals first, THEN all additions.
 * If an element appears in both lists, it was moved (not truly removed).
 *
 * Performance optimization: we use a Set to track known elements.
 * On each mutation, we only fire callbacks for elements we haven't
 * seen before (connected) or elements we no longer see (disconnected).
 */
export class ElementLifecycleObserver {
  private options: LifecycleObserverOptions;
  private observer: MutationObserver | null = null;
  private knownElements: Set<HTMLElement> = new Set();
  private running = false;

  constructor(options: LifecycleObserverOptions) {
    this.options = options;
  }

  /**
   * Start observing.
   *
   * Does an initial scan to find all currently-connected elements,
   * then sets up the MutationObserver for ongoing tracking.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    const root = this.options.root || document.body;
    if (!root) return;

    // Initial scan — find all currently-connected elements
    const existing = root.querySelectorAll<HTMLElement>(this.options.selector);
    for (const el of existing) {
      this.knownElements.add(el);
      const id = this.options.idAttribute
        ? el.getAttribute(this.options.idAttribute)
        : null;
      this.options.callback(el, 'connected', id);
    }

    // Set up MutationObserver
    this.observer = new MutationObserver((mutations) => {
      this.processMutations(mutations);
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop observing and clean up.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Fire disconnected for all known elements
    for (const el of this.knownElements) {
      const id = this.options.idAttribute
        ? el.getAttribute(this.options.idAttribute)
        : null;
      this.options.callback(el, 'disconnected', id);
    }

    this.knownElements.clear();
  }

  /**
   * Get all currently tracked elements.
   */
  getKnownElements(): Set<HTMLElement> {
    return new Set(this.knownElements);
  }

  /**
   * Process a batch of mutations.
   *
   * The key insight: we collect ALL added and removed elements first,
   * then process them. This handles the "moved element" case where
   * an element is removed from one parent and added to another in
   * the same mutation batch.
   */
  private processMutations(mutations: MutationRecord[]): void {
    const added = new Set<HTMLElement>();
    const removed = new Set<HTMLElement>();

    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      // Check added nodes
      for (const node of mutation.addedNodes) {
        // Note: using literal 1 instead of Node.ELEMENT_NODE because
        // Node isn't available as a global in all test environments (jsdom)
        if (node.nodeType !== 1) continue;
        const el = node as HTMLElement;

        // Check if the added node itself matches
        if (el.matches?.(this.options.selector)) {
          added.add(el);
        }

        // Check if the added node contains matching elements
        const children = el.querySelectorAll?.<HTMLElement>(this.options.selector);
        if (children) {
          for (const child of children) {
            added.add(child);
          }
        }
      }

      // Check removed nodes
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== 1) continue;
        const el = node as HTMLElement;

        // Check if the removed node itself matches
        if (el.matches?.(this.options.selector)) {
          removed.add(el);
        }

        // Check if the removed node contains matching elements
        const children = el.querySelectorAll?.<HTMLElement>(this.options.selector);
        if (children) {
          for (const child of children) {
            removed.add(child);
          }
        }
      }
    }

    // Process removals first
    // An element that was both removed AND added is a MOVE — not a true removal.
    for (const el of removed) {
      if (added.has(el)) continue; // It was moved, not removed

      if (this.knownElements.has(el)) {
        this.knownElements.delete(el);
        const id = this.options.idAttribute
          ? el.getAttribute(this.options.idAttribute)
          : null;
        this.options.callback(el, 'disconnected', id);
      }
    }

    // Process additions
    for (const el of added) {
      if (this.knownElements.has(el)) continue; // Already known

      this.knownElements.add(el);
      const id = this.options.idAttribute
        ? el.getAttribute(this.options.idAttribute)
        : null;
      this.options.callback(el, 'connected', id);
    }
  }
}
