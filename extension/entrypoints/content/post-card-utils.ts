// filepath: entrypoints/content/post-card-utils.ts
/**
 * POST CARD UTILITIES — Identify Real Post Cards in Google Classroom
 *
 * Google Classroom puts `data-stream-item-id` on MULTIPLE elements within
 * a single visual post card:
 *   - The actual post card container
 *   - `data-role="student"` header elements (small, in the author area)
 *   - `jscontroller="h38nBf"` three-dots menu containers
 *   - `jscontroller="yP6Lwf"` materials section controllers
 *   - Other internal jscontroller elements
 *
 * The legacy scanners (comment_frame, edited_frame) query `[data-stream-item-id]`
 * and iterate ALL matches. Without filtering, overlays and badges can be attached
 * to internal elements (like the three-dots button) instead of the visual card.
 *
 * This module provides utilities to:
 * 1. Filter out non-card elements from querySelectorAll results
 * 2. Find the correct visual card container for a given stream-item element
 *
 * @author Adham — fixes the three-dots border issue
 * @since v1.5.0
 */

const POST_SELECTOR = '[data-stream-item-id]';
const INTERNAL_STREAM_ITEM_CONTROLLERS = new Set([
  'h38nBf',
]);

function isIgnoredInternalStreamItemElement(el: HTMLElement): boolean {
  if (el.hasAttribute('data-role')) return true;

  const jscontroller = (el.getAttribute('jscontroller') || '').trim();
  if (jscontroller && INTERNAL_STREAM_ITEM_CONTROLLERS.has(jscontroller)) {
    return true;
  }

  return false;
}

function isPromotableWrapperDescendant(el: HTMLElement): boolean {
  if (isIgnoredInternalStreamItemElement(el)) return false;

  // Material/topic cards often expose the stream item on a compact controller
  // instead of the outer rounded wrapper. Preserve wrapper promotion there.
  if (el.hasAttribute('data-material-parent-id')) return true;
  if (el.matches('div.sVNOQ[data-stream-item-id], li[data-stream-item-id]')) return true;

  return el.offsetHeight === 0 || el.offsetHeight >= 80;
}

/**
 * Check if a `[data-stream-item-id]` element is the actual visual post card
 * (not an internal Google Classroom tracking element).
 *
 * Internal elements are identified by:
 * - Having `data-role` attribute (e.g., `data-role="student"`)
 * - Being very small (height < 80px — internal trackers, not visible cards)
 * - Being nested inside another `[data-stream-item-id]` element
 *
 * @param el - Element to check
 * @returns true if this looks like a real post card
 */
export function isActualPostCard(el: HTMLElement): boolean {
  // Skip known internal tracking/menu elements.
  if (isIgnoredInternalStreamItemElement(el)) return false;

  // Skip elements nested inside another post
  if (el.parentElement?.closest(POST_SELECTOR)) return false;

  // Skip elements that are too small to be a post card.
  // Real post cards are tall (200px+); internal elements are tiny.
  // Use 80px threshold to be safe — even collapsed classwork items are > 80px.
  if (el.offsetHeight > 0 && el.offsetHeight < 80) return false;

  return true;
}

/**
 * Given a `[data-stream-item-id]` element that might be an internal element,
 * walk UP the DOM to find the visual post card container.
 *
 * The visual card is typically the outermost element that:
 * 1. Has significant height (> 120px)
 * 2. Has computed border-radius (cards have rounded corners)
 * 3. Is not itself inside another card
 *
 * @param el - The element to start from
 * @returns The visual card container (may be the same element if it's already the card)
 */
export function findVisualCardContainer(el: HTMLElement): HTMLElement {
  // If this element is already a valid post card, use it
  if (isActualPostCard(el) && el.offsetHeight > 120) {
    return el;
  }

  // Walk up to find the card container
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    // Known Classroom card wrapper class — direct match
    if (current.classList.contains('n4xnA')) {
      return current;
    }

    // Check if this looks like a card (tall, has background/border)
    if (current.offsetHeight > 120 && current.offsetWidth > 200) {
      const style = window.getComputedStyle(current);
      // Card containers typically have border-radius and/or background
      if (
        (parseInt(style.borderRadius) > 0) ||
        (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent')
      ) {
        return current;
      }
    }
    current = current.parentElement;
  }

  // Fallback: return original element
  return el;
}

/**
 * Query all REAL post cards on the page.
 *
 * This is the replacement for `document.querySelectorAll('[data-stream-item-id]')`
 * that properly filters out internal Google elements.
 *
 * Also deduplicates by stream-item-id — if multiple elements share the same ID,
 * only the first valid card is returned.
 *
 * IMPORTANT: Only returns elements that directly have `data-stream-item-id`.
 * Does NOT walk up the DOM — ancestor walks can match page-level containers
 * and cause the entire page to be flagged.
 *
 * @returns Array of post card elements
 */
export function queryPostCards(): HTMLElement[] {
  const allElements = document.querySelectorAll<HTMLElement>(POST_SELECTOR);
  const seenIds = new Set<string>();
  const seenCards = new Set<HTMLElement>();
  const cards: HTMLElement[] = [];

  for (const el of allElements) {
    // Must be an actual post card, not an internal element
    if (!isActualPostCard(el)) continue;

    // Deduplicate by stream-item-id
    const id = el.getAttribute('data-stream-item-id');
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    seenCards.add(el);
    cards.push(el);
  }

  // Fallback: some posts (materials) only have data-stream-item-id on internal
  // elements, not on the card wrapper (.n4xnA). Query .n4xnA directly and add
  // any cards not already found via data-stream-item-id.
  const n4xnACards = document.querySelectorAll<HTMLElement>('.n4xnA');
  for (const el of n4xnACards) {
    if (seenCards.has(el)) continue;
    // Skip if this .n4xnA already contains one of our found cards (parent of a real card)
    let containsExisting = false;
    for (const existing of cards) {
      if (el.contains(existing)) { containsExisting = true; break; }
    }
    if (containsExisting) continue;
    // Skip tiny elements
    if (el.offsetHeight > 0 && el.offsetHeight < 80) continue;
    const descendants = Array.from(el.querySelectorAll<HTMLElement>(POST_SELECTOR));
    if (descendants.length === 0) continue;
    if (!descendants.some((child) => isPromotableWrapperDescendant(child))) continue;

    seenCards.add(el);
    cards.push(el);
  }

  return cards;
}
