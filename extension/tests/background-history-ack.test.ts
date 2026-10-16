// filepath: extension/tests/background-history-ack.test.ts
/**
 * cr9w — the history message acks. CQD_HISTORY_GET / CQD_HISTORY_CLEAR call
 * sendResponse asynchronously (after await), so their listener MUST return
 * true: with every onMessage listener returning falsy, MV3 closes the
 * response channel before the async ack lands and the popup's History panel
 * receives undefined forever. Found by the simulator-conductor spike driving
 * the real built extension (bead wupn).
 */
import { describe, expect, it } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';

describe('background history acks keep the response channel open (cr9w)', () => {
  it('CQD_HISTORY_GET: some listener returns true for the async ack', async () => {
    const harness = await loadFlowHarness();
    const returns = harness.dispatchMessageReturns({ type: 'CQD_HISTORY_GET', query: '' });
    expect(returns.some((r) => r === true)).toBe(true);
  });

  it('CQD_HISTORY_CLEAR: some listener returns true for the async ack', async () => {
    const harness = await loadFlowHarness();
    const returns = harness.dispatchMessageReturns({ type: 'CQD_HISTORY_CLEAR' });
    expect(returns.some((r) => r === true)).toBe(true);
  });

  it('sync-ack queue rows: CQD_QUEUE_GET still answers without holding the channel', async () => {
    const harness = await loadFlowHarness();
    const returns = harness.dispatchMessageReturns({ type: 'CQD_QUEUE_GET' });
    // Sync sendResponse before return false is valid; nothing may hang the
    // channel open accidentally for messages that do not need it.
    expect(returns.some((r) => r === true)).toBe(false);
  });
});
