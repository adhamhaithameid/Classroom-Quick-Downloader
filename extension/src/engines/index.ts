// filepath: extension/src/engines/index.ts
/**
 * ============================================================================
 * ENGINE BARREL — Central export for the multi-engine system
 * ============================================================================
 *
 * This is the ONE import you need to access the engine layer:
 *   import { engineRegistry, EngineV1, EngineV2, EngineV3 } from '../engines';
 *
 * Everything is re-exported from here so other modules don't need
 * to know the internal file structure of the engines directory.
 *
 * @author Adham — keeping imports clean since day one
 * @since v4.0.0
 */

// Types
export * from './types';

// Registry
export { EngineRegistry, engineRegistry } from './engine-registry';

// Engines
export { EngineV1 } from './v1/engine-v1';
export { EngineV2 } from './v2/engine-v2';
export { EngineV3 } from './v3/engine-v3';
