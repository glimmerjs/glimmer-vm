import * as hir from '../2-symbol-allocation/hir';

/**
 * This is the mutable state for this compiler pass.
 */
export class NormalizationState {
  constructor(private cursorCount = 0) {}

  generateUniqueCursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

export type HirStmt = hir.Statement | hir.Ignore;
