import type { SourceLocation } from '../v1/handlebars-ast';

export type { SourceLocation } from '../v1/handlebars-ast';

export interface SourcePosition {
  /** >= 1 */
  line: number;
  /** >= 0 */
  column: number;
}

export const UNKNOWN_POSITION: SourcePosition = Object.freeze({
  line: 1,
  column: 0,
} as const);

export const SYNTHETIC_LOCATION: SourceLocation = Object.freeze({
  source: '(synthetic)',
  start: UNKNOWN_POSITION,
  end: UNKNOWN_POSITION,
} as const);

export const NON_EXISTENT_LOCATION: SourceLocation = Object.freeze({
  source: '(nonexistent)',
  start: UNKNOWN_POSITION,
  end: UNKNOWN_POSITION,
} as const);

export const BROKEN_LOCATION: SourceLocation = Object.freeze({
  source: '(broken)',
  start: UNKNOWN_POSITION,
  end: UNKNOWN_POSITION,
} as const);
