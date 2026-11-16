// filepath: extension/src/v2/model/index.ts
/**
 * ============================================================================
 * MODEL BARREL — Central export for the V2 canonical data model
 * ============================================================================
 *
 * Import everything model-related from here:
 *   import { DOMScanner, CourseContext, ... } from '../../v2/model';
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
