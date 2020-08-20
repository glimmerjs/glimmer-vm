import { NonemptyStack } from '@glimmer/util';
import * as pass2 from '../pass2/ops';
import { SourceOffsets } from '../shared/location';
import { InputOpArgs, Op, OpArgs, OpConstructor, UnlocatedOp } from '../shared/op';
import { OpFactory, Ops } from '../shared/ops';
import { ProgramSymbolTable, SymbolTable } from '../shared/symbol-table';
import { CompilerHelper } from './index';
import * as pass1 from './ops';

/**
 * This is the mutable state for this compiler pass.
 */
export class CompilerState {
  readonly symbols: NonemptyStack<SymbolTable>;
  private cursorCount = 0;

  constructor(readonly top: ProgramSymbolTable) {
    this.symbols = new NonemptyStack([top]);
  }

  cursor() {
    return `%cursor:${this.cursorCount++}%`;
  }
}

type Visitors<O extends pass1.AnyOp> = {
  [P in O['name']]: (
    op: O extends infer ThisOp & { name: P }
      ? ThisOp extends Op<unknown>
        ? OpArgs<ThisOp>
        : never
      : never,
    ctx: Context
  ) => pass2.Op[] | pass2.Op;
};

type VisitorFunc<N extends pass1.AnyOp> = (op: N['args'], ctx: Context) => pass2.Op[] | pass2.Op;

function visit<N extends pass1.AnyOp>(visitors: Visitors<N>, node: N, ctx: Context): pass2.Op[] {
  let f = visitors[node.name as N['name']] as VisitorFunc<pass1.AnyOp>;
  let result = f(node.args, ctx);

  if (Array.isArray(result)) {
    return result;
  } else {
    return [result];
  }
}

export interface Pass1Visitor {
  expressions: Visitors<pass1.Expr>;
  statements: Visitors<pass1.Statement>;
}

export class CompilerContext {
  readonly state: CompilerState;
  readonly factory: OpFactory<pass2.Op>;

  constructor(
    readonly source: string,
    symbols: ProgramSymbolTable,
    readonly visitor: Pass1Visitor
  ) {
    this.factory = new OpFactory(source);
    this.state = new CompilerState(symbols);
  }

  forOffsets(offsets: SourceOffsets | null): Context {
    return new Context(this, offsets);
  }
}

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context {
  readonly helper: CompilerHelper;

  constructor(readonly ctx: CompilerContext, readonly offsets: SourceOffsets | null) {
    this.helper = new CompilerHelper(this);
  }

  get symbols() {
    return this.ctx.state.symbols;
  }

  get templateSymbols(): ProgramSymbolTable {
    return this.symbols.nth(0) as ProgramSymbolTable;
  }

  get table() {
    return this.symbols.current;
  }

  cursor(): string {
    return this.ctx.state.cursor();
  }

  template(...args: InputOpArgs<pass2.Template>): UnlocatedOp<pass2.Template> {
    let factory = new OpFactory<pass2.Template>(this.ctx.source);

    return factory.op(pass2.Template, ...args);
  }

  setHasEval(): void {
    this.templateSymbols.setHasEval();
  }

  op<O extends pass2.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O {
    return this.unlocatedOp(name, ...args).offsets(this.offsets);
  }

  unlocatedOp<O extends pass2.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.ctx.factory.op(name, ...args);
  }

  ops(...ops: Ops<pass2.Op>[]): pass2.Op[] {
    return this.ctx.factory.ops(...ops);
  }

  map<T>(input: T[], callback: (input: T) => pass2.Op[]): pass2.Op[] {
    return this.ctx.factory.map(input, callback);
  }

  withBlock<T>(symbols: SymbolTable, callback: () => T): T {
    this.symbols.push(symbols);

    try {
      return callback();
    } finally {
      this.symbols.pop();
    }
  }

  startBlock(symbols: SymbolTable): void {
    this.symbols.push(symbols);
  }

  endBlock(): void {
    this.symbols.pop();
  }

  /**
   * This method visits a possibly missing expression, ensuring that a stack value
   * will be on the stack for pass2 to pop off.
   */
  visitOptionalExpr(node: pass1.Expr | undefined): pass2.Op[] {
    if (node === undefined) {
      return [this.op(pass2.Missing)];
    } else {
      return this.visitExpr(node);
    }
  }

  visitExpr(node: pass1.Expr | null): pass2.Op[] {
    if (node === null) {
      return [];
    } else {
      return visit(this.ctx.visitor.expressions, node, this);
    }
  }

  visitStmt<T extends pass1.Statement>(node: T | null): pass2.Op[] {
    if (node === null) {
      return [];
    } else {
      return visit(this.ctx.visitor.statements, node, this);
    }
  }
}
