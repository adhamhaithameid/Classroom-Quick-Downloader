// filepath: extension/src/adapters/dom/mutation-observer-dom-port.ts
/**
 * Real DomPort over the platform MutationObserver. The DetectEngine role is
 * the only caller allowed to `observe` — one live observer per page is a
 * gate (G3/G5), and this adapter is where that budget physically lives.
 */
import type { DomPort } from '../../contracts/ports';
import type { Unsubscribe } from '../../bus/event-bus';

export function createMutationObserverDomPort(document: Document): DomPort {
  return {
    document,

    querySelectorAll<T extends Element = Element>(selector: string, root?: ParentNode) {
      const scope = root ?? document;
      return Array.from(scope.querySelectorAll<T>(selector));
    },

    observe(options, callback): Unsubscribe {
      const observer = new MutationObserver(callback);
      observer.observe(document, options);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        observer.disconnect();
      };
    },
  };
}
