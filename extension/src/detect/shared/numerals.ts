// filepath: extension/src/detect/shared/numerals.ts
/**
 * NUMERALS — moved to src/core/detect/numerals.ts (Engine V4 S4 core
 * extraction). This shim keeps the existing import path alive for existing
 * consumers; new code should import from core directly.
 */

export {
  isDigit,
  hasDigit,
  digitValue,
  extractDigitCount,
} from '../../core/detect/numerals';
