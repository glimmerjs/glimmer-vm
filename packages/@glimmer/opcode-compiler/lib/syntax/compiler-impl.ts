import type { BuilderOp, HighLevelOp, SexpOpcode, SexpOpcodeMap } from '@glimmer/interfaces';
import { assert, unwrap } from '@glimmer/util';

export type PushExpressionOp = (...op: BuilderOp | HighLevelOp) => void;

declare const STATEMENT: unique symbol;

export type HighLevelStatementOp = [{ [STATEMENT]: undefined }];

export type PushStatementOp = (...op: BuilderOp | HighLevelOp | HighLevelStatementOp) => void;

export type CompilerFunction<PushOp extends PushExpressionOp, TSexp> = (
  op: PushOp,
  sexp: TSexp
) => void;

export class Compilers<PushOp extends PushExpressionOp, TSexpOpcodes extends SexpOpcode> {
  readonly #names: Record<number, number> = {};
  readonly #funcs: CompilerFunction<PushOp, any>[] = [];

  readonly add = <TSexpOpcode extends TSexpOpcodes>(
    name: TSexpOpcode,
    fn: CompilerFunction<PushOp, SexpOpcodeMap[TSexpOpcode]>
  ): void => {
    this.#names[name] = this.#funcs.push(fn) - 1;
  };

  readonly compile = (op: PushOp, sexp: SexpOpcodeMap[TSexpOpcodes]): void => {
    let name = sexp[0];
    let index = unwrap(this.#names[name]);
    let function_ = this.#funcs[index];
    assert(!!function_, `expected an implementation for ${sexp[0]}`);

    function_(op, sexp);
  };
}
