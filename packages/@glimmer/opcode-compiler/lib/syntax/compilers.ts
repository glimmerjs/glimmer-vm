import type { BuilderOp, HighLevelOp, SexpOpcode, SexpOpcodeMap } from '@glimmer/interfaces';
import { localAssert, unwrap } from '@glimmer/debug-util';
import type { EncodeOp } from '../opcode-builder/encoder';

export type BuildExpression = (...op: BuilderOp | HighLevelOp) => void;

declare const STATEMENT: unique symbol;

export type HighLevelStatementOp = [{ [STATEMENT]: undefined }];

export type BuildStatement = (...op: BuilderOp | HighLevelOp | HighLevelStatementOp) => void;

export type CompilerFunction<TSexp> = (op: EncodeOp, sexp: TSexp) => void;

export class Compilers<TSexpOpcodes extends SexpOpcode> {
  private names: {
    [name: number]: number;
  } = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private funcs: CompilerFunction<any>[] = [];

  add<TSexpOpcode extends TSexpOpcodes>(
    name: TSexpOpcode,
    func: CompilerFunction<SexpOpcodeMap[TSexpOpcode]>
  ): void {
    this.names[name] = this.funcs.push(func) - 1;
  }

  compile(op: EncodeOp, sexp: SexpOpcodeMap[TSexpOpcodes]): void {
    let name = sexp[0];
    let index = unwrap(this.names[name]);
    let func = this.funcs[index];
    localAssert(!!func, `expected an implementation for ${sexp[0]}`);

    func(op, sexp);
  }
}
