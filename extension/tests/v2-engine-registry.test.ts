// filepath: extension/tests/v2-engine-registry.test.ts
/**
 * ============================================================================
 * V2 ENGINE REGISTRY — Full Test Suite
 * ============================================================================
 *
 * Exhaustive tests for the EngineRegistry — the switchboard that
 * controls which engines are active based on the current mode.
 *
 * Categories:
 * 1. Registration — register, unregister, duplicate handling
 * 2. Mode management — setMode, getMode, default mode
 * 3. Active engines — getActiveEngines by mode mapping
 * 4. Primary/secondary — getPrimaryEngine, getSecondaryEngines
 * 5. Mode change callback — fires on mode change
 * 6. Edge cases — unknown modes, missing engines, summary
 *
 * @author Adham — testing the switchboard before wiring it up
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineRegistry } from '../src/engines/engine-registry';
import type { CQDEngine, ViewKind, PostNode, FileNode, FlagDecision, PlacementDecision, DecisionTrace } from '../src/engines/types';

// ============================================================================
// MOCK ENGINE FACTORY
// ============================================================================

function createMockEngine(name: string, version = '1.0.0'): CQDEngine {
  return {
    name,
    version,
    init: vi.fn(async () => {}),
    destroy: vi.fn(),
    handleMutations: vi.fn(),
    fullScan: vi.fn(),
    getTrackedPosts: vi.fn(() => []),
    getPlacementDecisions: vi.fn(() => []),
    getFlagDecisions: vi.fn(() => []),
    getDecisionTrace: vi.fn(() => null),
  };
}

// ============================================================================
// REGISTRATION
// ============================================================================

describe('EngineRegistry: Registration', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
  });

  it('registers an engine and exposes it via getEngine', () => {
    const v1 = createMockEngine('engine-v1', '1.3.9');
    registry.register(v1);

    expect(registry.getEngine('engine-v1')).toBe(v1);
  });

  it('registers multiple engines', () => {
    const v1 = createMockEngine('engine-v1');
    const v2 = createMockEngine('engine-v2');
    const v3 = createMockEngine('engine-v3');

    registry.register(v1);
    registry.register(v2);
    registry.register(v3);

    expect(registry.getAllRegistered()).toHaveLength(3);
  });

  it('replaces a previously registered engine with the same name', () => {
    const v1old = createMockEngine('engine-v1', '1.0.0');
    const v1new = createMockEngine('engine-v1', '2.0.0');

    registry.register(v1old);
    registry.register(v1new);

    expect(registry.getEngine('engine-v1')?.version).toBe('2.0.0');
    expect(registry.getAllRegistered()).toHaveLength(1);
  });

  it('unregisters an engine', () => {
    const v1 = createMockEngine('engine-v1');
    registry.register(v1);
    registry.unregister('engine-v1');

    expect(registry.getEngine('engine-v1')).toBeNull();
    expect(registry.getAllRegistered()).toHaveLength(0);
  });

  it('unregister ignores non-existent engines', () => {
    // Should not throw
    registry.unregister('nonexistent');
    expect(registry.getAllRegistered()).toHaveLength(0);
  });

  it('getEngine returns null for unregistered name', () => {
    expect(registry.getEngine('nonexistent')).toBeNull();
  });
});

// ============================================================================
// MODE MANAGEMENT
// ============================================================================

describe('EngineRegistry: Mode Management', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
  });

  it('defaults to legacy mode', () => {
    expect(registry.getMode()).toBe('legacy');
  });

  it('sets and gets mode', () => {
    registry.setMode('shadow');
    expect(registry.getMode()).toBe('shadow');

    registry.setMode('v2');
    expect(registry.getMode()).toBe('v2');

    registry.setMode('v3');
    expect(registry.getMode()).toBe('v3');
  });

  it('ignores redundant mode set (same mode)', () => {
    const callback = vi.fn();
    registry.setModeChangeCallback(callback);

    registry.setMode('shadow');
    expect(callback).toHaveBeenCalledTimes(1);

    // Same mode again — should NOT fire callback
    registry.setMode('shadow');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires onModeChange callback when mode changes', () => {
    const callback = vi.fn();
    registry.setModeChangeCallback(callback);

    registry.setMode('shadow');
    expect(callback).toHaveBeenCalledWith('shadow');

    registry.setMode('v2');
    expect(callback).toHaveBeenCalledWith('v2');
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not fire callback if none is set', () => {
    // Should not throw
    registry.setMode('v2');
    expect(registry.getMode()).toBe('v2');
  });
});

// ============================================================================
// ACTIVE ENGINES BY MODE
// ============================================================================

describe('EngineRegistry: Active Engines', () => {
  let registry: EngineRegistry;
  let v1: CQDEngine;
  let v2: CQDEngine;
  let v3: CQDEngine;

  beforeEach(() => {
    registry = new EngineRegistry();
    v1 = createMockEngine('engine-v1');
    v2 = createMockEngine('engine-v2');
    v3 = createMockEngine('engine-v3');
    registry.register(v1);
    registry.register(v2);
    registry.register(v3);
  });

  it('legacy mode → only V1', () => {
    registry.setMode('legacy');
    const active = registry.getActiveEngines();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('engine-v1');
  });

  it('shadow mode → V1 first (primary), V2 second (secondary)', () => {
    registry.setMode('shadow');
    const active = registry.getActiveEngines();
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('engine-v1');
    expect(active[1].name).toBe('engine-v2');
  });

  it('v2 mode → only V2', () => {
    registry.setMode('v2');
    const active = registry.getActiveEngines();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('engine-v2');
  });

  it('v3 mode → only V3', () => {
    registry.setMode('v3');
    const active = registry.getActiveEngines();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('engine-v3');
  });

  it('returns empty if required engine is not registered', () => {
    const emptyRegistry = new EngineRegistry();
    emptyRegistry.setMode('legacy');

    const active = emptyRegistry.getActiveEngines();
    expect(active).toHaveLength(0);
  });

  it('partial registration: shadow with only V1 registered', () => {
    const partial = new EngineRegistry();
    partial.register(v1);
    partial.setMode('shadow');

    const active = partial.getActiveEngines();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('engine-v1');
  });
});

// ============================================================================
// PRIMARY / SECONDARY ENGINES
// ============================================================================

describe('EngineRegistry: Primary & Secondary', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
    registry.register(createMockEngine('engine-v1'));
    registry.register(createMockEngine('engine-v2'));
    registry.register(createMockEngine('engine-v3'));
  });

  it('primary in legacy mode is V1', () => {
    registry.setMode('legacy');
    expect(registry.getPrimaryEngine()?.name).toBe('engine-v1');
  });

  it('primary in shadow mode is V1 (V1 renders)', () => {
    registry.setMode('shadow');
    expect(registry.getPrimaryEngine()?.name).toBe('engine-v1');
  });

  it('primary in v2 mode is V2', () => {
    registry.setMode('v2');
    expect(registry.getPrimaryEngine()?.name).toBe('engine-v2');
  });

  it('secondary in shadow mode is [V2]', () => {
    registry.setMode('shadow');
    const secondary = registry.getSecondaryEngines();
    expect(secondary).toHaveLength(1);
    expect(secondary[0].name).toBe('engine-v2');
  });

  it('secondary in legacy mode is empty', () => {
    registry.setMode('legacy');
    expect(registry.getSecondaryEngines()).toHaveLength(0);
  });

  it('secondary in v2 mode is empty', () => {
    registry.setMode('v2');
    expect(registry.getSecondaryEngines()).toHaveLength(0);
  });

  it('getPrimaryEngine returns null when no engines are registered', () => {
    const empty = new EngineRegistry();
    expect(empty.getPrimaryEngine()).toBeNull();
  });
});

// ============================================================================
// SUMMARY
// ============================================================================

describe('EngineRegistry: Summary', () => {
  it('produces readable summary with active markers', () => {
    const registry = new EngineRegistry();
    registry.register(createMockEngine('engine-v1', '1.3.9'));
    registry.register(createMockEngine('engine-v2', '4.0.0'));
    registry.setMode('shadow');

    const summary = registry.getSummary();
    expect(summary).toContain('shadow');
    expect(summary).toContain('engine-v1');
    expect(summary).toContain('engine-v2');
    expect(summary).toContain('(active)');
  });
});
