// filepath: extension/tests/fakes/fake-dom-port.ts
/**
 * DomPort fake over any Document (jsdom/happy-dom in tests). Mutations are
 * delivered only when the test flushes, so observer-driven code is
 * deterministic.
 */
import type { DomPort } from '../../src/contracts/ports';
import type { Unsubscribe } from '../../src/bus/event-bus';

type MutationCallback = (mutations: MutationRecord[]) => void;

export interface FakeDomPort extends DomPort {
  /** Deliver a synthetic mutation record to every observer. */
  emitMutation(record: Partial<MutationRecord>): void;
  /** Deliver a synthetic childList mutation for an added node. */
  flushMutations(): void;
  /** Idempotent disconnect for every observer this port handed out. */
  disconnectAll(): void;
}

export function createFakeDomPort(document: Document = window.document): FakeDomPort {
  const observers = new Map<number, MutationCallback>();
  let nextId = 1;

  function notify(record: MutationRecord): void {
    for (const callback of observers.values()) callback([record]);
  }

  return {
    document,

    querySelectorAll<T extends Element = Element>(selector: string, root?: ParentNode) {
      const scope = root ?? document;
      return Array.from(scope.querySelectorAll<T>(selector));
    },

    observe(options, callback) {
      const id = nextId++;
      observers.set(id, callback);
      let active = true;
      const unsubscribe: Unsubscribe = () => {
        if (!active) return;
        active = false;
        observers.delete(id);
      };
      return unsubscribe;
    },

    emitMutation(record) {
      const target = record.target ?? document.body;
      notify({
        type: 'childList',
        target,
        addedNodes: [],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null,
        ...record,
      } as unknown as MutationRecord);
    },

    flushMutations() {
      if (document.body.childNodes.length > 0) {
        notify({
          type: 'childList',
          target: document.body,
          addedNodes: Array.from(document.body.childNodes),
          removedNodes: [],
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null,
        } as unknown as MutationRecord);
      }
    },

    disconnectAll() {
      observers.clear();
    },
  };
}
