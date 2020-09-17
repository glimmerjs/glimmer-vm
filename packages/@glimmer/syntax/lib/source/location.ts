import { Optional, PresentArray } from '@glimmer/interfaces';
import { isPresent } from '@glimmer/util';
import { SourceOffsets } from './offsets';

export interface SourceLocation {
  source?: Optional<string>;
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourcePosition {
  /** >= 1 */
  line: number;
  /** >= 0 */
  column: number;
}

export const SYNTHETIC = Object.freeze({
  source: '(synthetic)',
  start: { line: 1, column: 0 },
  end: { line: 1, column: 0 },
} as const);

export type LocatedWithOffsets = { offsets: SourceOffsets };
export type LocatedWithOptionalOffsets = { offsets: SourceOffsets | null };

export type LocatedWithPositions = { loc: SourceLocation };
export type LocatedWithOptionalPositions = { loc?: SourceLocation };

export function isLocatedWithPositionsArray(
  location: LocatedWithOptionalPositions[]
): location is PresentArray<LocatedWithPositions> {
  return isPresent(location) && location.every(isLocatedWithPositions);
}

export function isLocatedWithPositions(
  location: LocatedWithOptionalPositions
): location is LocatedWithPositions {
  return location.loc !== undefined;
}

export type HasSourceLocation =
  | SourceLocation
  | LocatedWithPositions
  | PresentArray<LocatedWithPositions>;

export type MaybeHasSourceLocation =
  | null
  | LocatedWithOptionalPositions
  | LocatedWithOptionalPositions[];
