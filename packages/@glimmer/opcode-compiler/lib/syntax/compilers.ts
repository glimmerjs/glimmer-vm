import type {
  BuilderOp,
  HighLevelOp,
  LabelOperand,
  SexpOpcode,
  SexpOpcodeMap,
} from '@glimmer/interfaces';
import { assert, unwrap } from '@glimmer/util';
import { HighLevelBuilderOpcodes } from '../opcode-builder/opcodes';
import { labelOperand } from '../opcode-builder/operands';

export interface PushOp<Op extends unknown[]> {
  (...op: Op): void;
  (...op: HighLevelOp): void;
  label: (name: string) => void;
  target: (name: string) => LabelOperand;
  labels: (block: () => void) => void;
}

export type PushExpressionOp = PushOp<BuilderOp | HighLevelOp>;
export type PushStatementOp = PushOp<BuilderOp | HighLevelOp | HighLevelStatementOp>;

export function definePushOp<Op extends unknown[]>(
  fn: ((...op: Op) => void) & ((...op: HighLevelOp) => void)
): PushOp<Op> {
  function op(...op: Parameters<typeof fn>): void {
    fn(...op);
  }

  op.label = (name: string) => {
    op(HighLevelBuilderOpcodes.Label, name);
  };

  op.labels = (block: () => void) => {
    op(HighLevelBuilderOpcodes.StartLabels);
    block();
    op(HighLevelBuilderOpcodes.StopLabels);
  };

  op.target = (target: string) => labelOperand(target);

  return op as PushOp<Op>;
}

declare const STATEMENT: unique symbol;

export type HighLevelStatementOp = [{ [STATEMENT]: undefined }];

export type CompilerFunction<PushOp extends PushExpressionOp, TSexp> = (
  op: PushOp,
  sexp: TSexp
) => void;

export class Compilers<PushOp extends PushExpressionOp, TSexpOpcodes extends SexpOpcode> {
  readonly #names: {
    [name: number]: number;
  } = {};

  readonly #funcs: CompilerFunction<PushOp, any>[] = [];

  add<TSexpOpcode extends TSexpOpcodes>(
    name: TSexpOpcode,
    func: CompilerFunction<PushOp, SexpOpcodeMap[TSexpOpcode]>
  ): void {
    this.#names[name] = this.#funcs.push(func) - 1;
  }

  compile(op: PushOp, sexp: SexpOpcodeMap[TSexpOpcodes]): void {
    let name = sexp[0];
    let index = unwrap(this.#names[name]);
    let func = this.#funcs[index];
    assert(!!func, `expected an implementation for ${sexp[0]}`);

    func(op, sexp);
  }
}
