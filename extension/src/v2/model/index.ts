// filepath: extension/src/v2/model/index.ts
/**
 * ============================================================================
 * MODEL BARREL — Central export for the V2 canonical data model
 * ============================================================================
 *
 * Import everything model-related from here:
 *   import { DOMScanner, reconcile, CourseContext, ... } from '../../v2/model';
 *
 * @author Adham - i need help
 * @since v4.0.0
 */

// Entities (data types + factories)
export type { CourseContext, PostModel, FileModel } from './entities';
export {
    getCanonicalFileId,
    computeFingerprint,
    createCourseContext,
    createPostModel,
    createFileModel,
} from './entities';

// DOM Scanner
export { DOMScanner } from './dom-scanner';
export type { ScanResult, ScannedPost, ScannedFile } from './dom-scanner';

// Reconciler
export { reconcile, applyOpsToModel } from './reconciler';
export type { ReconcileOp, ReconcileResult } from './reconciler';

// Element lifecycle
export { ElementLifecycleObserver } from './element-lifecycle';
export type { LifecycleCallback, LifecycleObserverOptions } from './element-lifecycle';

// Viewport observer
export { ViewportObserver } from './viewport-observer';
export type { ViewportZone, ViewportChangeCallback, ViewportObserverOptions } from './viewport-observer';
