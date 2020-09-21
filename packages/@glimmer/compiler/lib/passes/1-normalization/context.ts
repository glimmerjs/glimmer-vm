import { Source } from '@glimmer/syntax';
import { InputOpArgs, OpConstructor, toArgs, UnlocatedOp } from '../../shared/op';
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

type VisitableHirOp = hir.Statement | hir.Expr | hir.Internal;
export type HirStmt = hir.Statement | hir.Ignore;
type HirOp = VisitableHirOp | hir.Ignore;

/**
 * This class provides useful utilities to the visitors. None of the methods on this
 * class should work directly with the inner state in NormalizationState.
 */
export class NormalizationUtilities {
  constructor(readonly source: Source, private state: NormalizationState) {}

  generateUniqueCursor(): string {
    return this.state.generateUniqueCursor();
  }

  op<O extends HirOp>(op: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return new UnlocatedOp(op, toArgs(args), this.source);
  }
}
