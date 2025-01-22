import type { BuilderOp, HighLevelOp, SexpOpcode, SexpOpcodeMap } from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

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
    const index = this.names[name];

    if (LOCAL_DEBUG && index === undefined) {
      const opName = Object.entries(Op).find(([_, value]) => value === name);
      throw new Error(
        `expected an implementation for ${opName?.[0]} (${name}) (${JSON.stringify(sexp)})`
      );
    }

    let func = unwrap(this.funcs[index as number]);

    func(op, sexp);
  }
}
