// filepath: extension/tests/strategy-chain.test.ts
/**
 * No-dead-ends program — the acquisition strategy chain invariants.
 */
import { describe, expect, it } from 'vitest';
import {
  ACQUIRE_STRATEGY_CHAIN,
  nextStrategyFor,
} from '../src/strategies/acquire/strategy-chain';

describe('acquisition strategy chain', () => {
  it('direct is first, drive-auth answers forbidden, api tier is disabled', () => {
    expect(ACQUIRE_STRATEGY_CHAIN[0].name).toBe('direct');
    const auth = ACQUIRE_STRATEGY_CHAIN.find((s) => s.name === 'drive-auth');
    expect(auth?.answers).toContain('forbidden');
    expect(auth?.enabled()).toBe(true);
    const api = ACQUIRE_STRATEGY_CHAIN.find((s) => s.name === 'api');
    expect(api?.enabled()).toBe(false); // #398 gate
  });

  it('forbidden is answered by the drive-auth tier', () => {
    const next = nextStrategyFor('forbidden', ['direct']);
    expect(next?.name).toBe('drive-auth');
  });

  it('the disabled api tier is never returned, even as the only candidate', () => {
    expect(nextStrategyFor('forbidden', ['direct', 'drive-auth'])).toBeNull();
  });

  it('exhausting the chain returns null — the honest terminal condition', () => {
    expect(nextStrategyFor('permanent', ['direct'])).toBeNull();
  });

  it('every chain entry has a description (decision traces stay legible)', () => {
    for (const strategy of ACQUIRE_STRATEGY_CHAIN) {
      expect(strategy.describe.length).toBeGreaterThan(5);
    }
  });
});
