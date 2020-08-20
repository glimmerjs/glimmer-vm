import { ExpressionContext, Option } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { assert, isPresent, NonemptyStack, PresentArray } from '@glimmer/util';
import { positionToOffset, SourceOffsets } from '../shared/location';
import * as pass1 from '../pass1/ops';
import { InputOpArgs, OpConstructor, UnlocatedOp } from '../shared/op';
import { OpFactory, Ops } from '../shared/ops';
import { BlockSymbolTable, SymbolTable } from '../shared/symbol-table';
import { buildPathWithContext } from './utils/builders';

/** VISITOR DEFINITIONS */

type NodeFor<N extends AST.BaseNode, K extends N['type']> = N extends { type: K } ? N : never;

type Visitors<N extends AST.BaseNode, Out extends pass1.AnyOp[] | pass1.AnyOp> = {
  [P in N['type']]: (node: NodeFor<N, P>, ctx: Context) => Out;
};

export type StatementVisitor = Visitors<AST.Statement, pass1.Statement | pass1.Statement[]>;
export type ExpressionVisitor = Visitors<AST.Expression | AST.ConcatStatement, pass1.Expr>;

type VisitorFunc<N extends AST.BaseNode, Out extends pass1.AnyOp[] | pass1.AnyOp> = (
  node: N,
  ctx: Context
) => Out;

type StatementVisitorFunc = VisitorFunc<AST.Statement, pass1.Statement | pass1.Statement[]>;
type ExpressionVisitorFunc = VisitorFunc<AST.Expression, pass1.Expr>;

export interface ImmutableContext {
  slice(value: string): UnlocatedOp<pass1.SourceSlice>;
}

/**
 * This is the mutable state for this compiler pass.
 */
export class CompilerState {
  readonly symbols: NonemptyStack<SymbolTable> = new NonemptyStack([SymbolTable.top()]);
  private cursorCount = 0;

  cursor() {
    return `%cursor:${this.cursorCount++}%`;
  }
}

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context implements ImmutableContext {
  readonly statements: StatementVisitor;
  readonly expressions: ExpressionVisitor;
  readonly state = new CompilerState();
  private opFactory: OpFactory<pass1.Statement>;
  private exprFactory: OpFactory<pass1.Expr>;

  constructor(
    readonly source: string,
    readonly options: CompileOptions,
    visitor: { statements: StatementVisitor; expressions: ExpressionVisitor }
  ) {
    this.statements = visitor.statements;
    this.expressions = visitor.expressions;
    this.opFactory = new OpFactory(source);
    this.exprFactory = new OpFactory(source);
  }

  get symbols() {
    return this.state.symbols;
  }

  customizeComponentName(input: string): string {
    if (this.options.customizeComponentName) {
      return this.options.customizeComponentName(input);
    } else {
      return input;
    }
  }

  cursor(): string {
    return this.state.cursor();
  }

  template(...args: InputOpArgs<pass1.Template>): UnlocatedOp<pass1.Template> {
    let factory = new OpFactory<pass1.Template>(this.source);
    return factory.op(pass1.Template, ...args);
  }

  op<O extends pass1.Statement>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.opFactory.op(name, ...args);
  }

  expr<O extends pass1.Expr>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.exprFactory.op(name, ...args);
  }

  slice(value: string): UnlocatedOp<pass1.SourceSlice> {
    return new UnlocatedOp(pass1.SourceSlice, { value }, this.source);
  }

  ops(...ops: Ops<pass1.Statement>[]): pass1.Statement[] {
    return this.opFactory.ops(...ops);
  }

  mapIntoStatements<T>(input: T[], callback: (input: T) => pass1.Statement[]): pass1.Statement[] {
    return this.opFactory.map(input, callback);
  }

  append(expr: pass1.Expr, { trusted }: { trusted: boolean }): UnlocatedOp<pass1.Statement> {
    if (trusted) {
      return this.op(pass1.AppendTrustedHTML, {
        value: expr,
      });
    } else {
      return this.op(pass1.AppendTextNode, {
        value: expr,
      });
    }
  }

  mapIntoExprs<E extends pass1.Expr, T>(
    input: PresentArray<T>,
    callback: (input: T) => E[]
  ): PresentArray<E>;
  mapIntoExprs<E extends pass1.Expr, T>(
    input: Option<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Option<PresentArray<E>>;
  mapIntoExprs<E extends pass1.Expr, T>(
    input: Option<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Option<PresentArray<E>> {
    if (input === null) {
      return null;
    } else {
      return this.exprFactory.map(input, callback) as PresentArray<E>;
    }
  }

  withBlock<T>(
    block: AST.Block | AST.ElementNode,
    callback: (symbols: BlockSymbolTable, parent: SymbolTable) => T
  ): T {
    let parent = this.symbols.current;
    let child = this.symbols.current.child(block.blockParams);
    this.symbols.push(child);

    try {
      return callback(child, parent);
    } finally {
      this.symbols.pop();
    }
  }

  visitExpr(
    node: AST.Expression,
    context: ExpressionContext = ExpressionContext.Expression
  ): pass1.Expr {
    if (node.type === 'PathExpression') {
      return buildPathWithContext(this, node, context);
    } else {
      let f = this.expressions[node.type] as ExpressionVisitorFunc;
      return f(node, this);
    }
  }

  visitStmt<T extends AST.Statement>(node: T | null): pass1.Statement[] {
    if (node === null) {
      return [];
    } else {
      let f = this.statements[node.type] as StatementVisitorFunc;
      let result = f(node, this);

      if (Array.isArray(result)) {
        return result;
      } else {
        return [result];
      }
    }
  }

  visitBlock(name: pass1.SourceSlice, node: AST.Block): pass1.NamedBlock {
    return this.withBlock(node, symbols =>
      this.op(pass1.NamedBlock, {
        name,
        symbols,
        body: this.mapIntoStatements(node.body, stmt => this.visitStmt(stmt)),
      }).loc(node)
    );
  }
}

export function paramsOffsets(
  { path, params }: { path: AST.Expression; params: AST.Expression[] },
  source: string
): SourceOffsets {
  if (isPresent(params)) {
    return sourceOffsets(params as [AST.Expression, ...AST.Expression[]], source);
  } else {
    // position empty params after the first space after the path expression
    let pos = sourceOffsets(path, source).end + 1;
    return { start: pos, end: pos };
  }
}

export function offsetsForHashKey(pair: AST.HashPair, source: string): SourceOffsets {
  let pairLoc = sourceOffsets(pair, source);
  let valueLoc = sourceOffsets(pair.value, source);

  assert(pairLoc !== null && valueLoc !== null, `unexpected missing location in HashPair`);

  return {
    start: pairLoc.start,
    // the grammar requires `key=value` with no whitespace around the `=`
    end: valueLoc.start - 1,
  };
}

export function sourceOffsets(
  node: AST.BaseNode | [AST.BaseNode, ...AST.BaseNode[]],
  source: string
): SourceOffsets {
  if (Array.isArray(node)) {
    let start = node[0];
    let end = node[node.length - 1];

    let startOffset = sourceOffsets(start, source)?.start;
    let endOffset = sourceOffsets(end, source)?.start;

    assert(
      startOffset !== undefined && endOffset !== undefined,
      `unexpectedly missing source offsets`
    );

    return {
      start: startOffset,
      end: endOffset,
    };
  }

  let loc = node.loc;

  let { start, end } = loc;
  let startOffset = positionToOffset(source, { line: start.line - 1, column: start.column });

  // TODO Is it important to support buggy transformations? Should we have a strict mode to start ferreting them out?
  // assert(
  //   startOffset !== null,
  //   `unexpected offset (${start.line}:${start.column}) that didn't correspond to a source location`
  // );
  let endOffset = positionToOffset(source, { line: end.line - 1, column: end.column });
  // assert(
  //   endOffset !== null,
  //   `unexpected offset (${end.line}:${end.column}) that didn't correspond to a source location`
  // );

  if (startOffset === null || endOffset === null) {
    // @ts-expect-error
    return null;
  }

  return {
    start: startOffset,
    end: endOffset,
  };
}
