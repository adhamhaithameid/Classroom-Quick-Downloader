// filepath: extension/src/v2/orchestrator/bridge-relay.ts
/**
 * ============================================================================
 * BRIDGE RELAY — the page bus's download topics cross the BridgePort (S6, G2)
 * ============================================================================
 *
 * Page side of design §7: `download:requested` on the page bus becomes a
 * BridgeRequest to the worker context; every bridge response comes back as
 * `download:settled` on the same bus, correlated by requestId. `download:
 * progress` is worker→page push and joins in S10 when the acquire engine
 * publishes phases; today the settled topic is the whole contract.
 *
 * Imports bus + contracts only (fitness rule) — no DOM, no engine access.
 */
import type { EventBus } from '../../bus/event-bus';
import type { BridgePort } from '../../contracts/ports';
import type { PageTopicMap } from '../../contracts/topics';
import type { Unsubscribe } from '../../bus/event-bus';

export function wireBridgeRelay(
  bus: EventBus<PageTopicMap>,
  bridge: BridgePort,
): Unsubscribe {
  const offResponse = bridge.onResponse((requestId, response) => {
    bus.publish('download:settled', {
      requestId,
      outcome: response as PageTopicMap['download:settled']['outcome'],
    });
  });

  const offRequested = bus.subscribe('download:requested', ({ requestId, file, nameHint }) => {
    bridge.send({ requestId, payload: { file, nameHint } });
  });

  return () => {
    offRequested();
    offResponse();
  };
}
