// filepath: extension/src/v2/selectors/index.ts
/**
 * ============================================================================
 * SELECTORS BARREL — Central export for the smart selector system
 * ============================================================================
 *
 * Import everything selector-related from here:
 *   import { SelectorScorer, createPostScorer, ... } from '../../v2/selectors';
 *
 * @author Adham
 * @since v4.0.0
 */

export { SelectorScorer, SelectorLevel } from './selector-scorer';
export type { SelectorCandidate, ScorerResult, CandidateTrace } from './selector-scorer';

export {
  POST_CANDIDATES,
  FILE_ANCHOR_CANDIDATES,
  HEADER_CANDIDATES,
  COMMENT_FLAG_CANDIDATES,
  DATE_CONTAINER_CANDIDATES,
  USER_CONTENT_EXCLUSION_CANDIDATES,
  ACCORDION_STATE_CANDIDATES,
  createPostScorer,
  createFileAnchorScorer,
  createHeaderScorer,
  createCommentFlagScorer,
  createDateContainerScorer,
  createExclusionScorer,
  createAccordionScorer,
} from './selector-registry';
