import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { assert, isPresent, NonemptyStack } from '@glimmer/util';
import { TemplateIdFn } from '../../compiler';
import * as pass1 from '../pass1/ops';
import { positionToOffset, SourceOffsets } from '../shared/location';
import { InputOpArgs, OpConstructor, UnlocatedOp } from '../shared/op';
import { OpFactory } from '../shared/ops';
import { BlockSymbolTable, SymbolTable } from '../shared/symbol-table';
import { buildPathWithContext } from './utils/builders';
import { Pass0Expressions } from './visitors/expressions';
import { Pass0Statements } from './visitors/statements';

/** VISITOR DEFINITIONS */

type Pass0Visitor = Pass0Expressions | Pass0Statements;

export type VisitorInterface<O extends AST.Node, Out = unknown> = {
  [P in O['type']]: (node: O & { type: P }, ctx: Context) => Out;
};

type VisitorFunc<V extends Pass0Visitor, N extends keyof V & keyof AST.Nodes> = (
  node: AST.Node & AST.Nodes[N],
  ctx: Context
) => VisitorReturn<V, N>;

type VisitorReturn<
  V extends Pass0Visitor,
  N extends keyof V & keyof AST.Nodes = keyof V & keyof AST.Nodes
> = V[N] extends (...args: any[]) => infer R ? (R extends Pass1Op ? R : never) : never;

export interface ImmutableContext {
  slice(value: string): UnlocatedOp<pass1.SourceSlice>;
}

/**
 * This is the mutable state for this compiler pass.
 */
export class CompilerState {
  readonly symbols: NonemptyStack<SymbolTable> = new NonemptyStack([SymbolTable.top()]);
  private cursorCount = 0;

  cursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

export interface GlimmerCompileOptions extends PrecompileOptions {
  id?: TemplateIdFn;
  meta?: object;
  customizeComponentName?(input: string): string;
}

type VisitablePass1Op = pass1.Statement | pass1.Expr | pass1.Internal;
export type Pass1Stmt =
  | pass1.Statement
  | pass1.TemporaryNamedBlock
  | pass1.NamedBlock
  | pass1.Ignore;
type Pass1Op = VisitablePass1Op | pass1.TemporaryNamedBlock | pass1.Ignore;

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context implements ImmutableContext {
  readonly statements: Pass0Statements;
  readonly expressions: Pass0Expressions;
  readonly state = new CompilerState();
  private factory: OpFactory<Pass1Op>;

  constructor(
    readonly source: string,
    readonly options: GlimmerCompileOptions,
    visitor: { statements: Pass0Statements; expressions: Pass0Expressions }
  ) {
    this.statements = visitor.statements;
    this.expressions = visitor.expressions;
    this.factory = new OpFactory(source);
  }

  get symbols(): NonemptyStack<SymbolTable> {
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

  op<O extends Pass1Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.factory.op(name, ...args);
  }

  slice(value: string): UnlocatedOp<pass1.SourceSlice> {
    return new UnlocatedOp(pass1.SourceSlice, { value }, this.source);
  }

  visitAmbiguousStmts<S extends AST.Statement>(
    statements: S[]
  ): (pass1.Statement | pass1.TemporaryNamedBlock)[] {
    let out: (pass1.Statement | pass1.TemporaryNamedBlock)[] = [];

    for (let statement of statements) {
      let result = this.visitAmbiguousStmt(statement);

      switch (result.name) {
        case 'Ignore':
          break;
        default:
          out.push(result);
      }
    }

    return out;
    // return this.factory
    //   .map(input, callback)
    //   .filter((n: Out): n is Exclude<Out, pass1.Ignore> => n.name !== 'Ignore');
  }

  visitStmts<S extends AST.Statement>(statements: S[]): pass1.Statement[] {
    let out: pass1.Statement[] = [];

    for (let statement of statements) {
      let result = this.visitStmt(statement);

      switch (result.name) {
        case 'Ignore':
          break;
        default:
          out.push(result);
      }
    }

    return out;
    // return this.factory
    //   .map(input, callback)
    //   .filter((n: Out): n is Exclude<Out, pass1.Ignore> => n.name !== 'Ignore');
  }

  mapIntoOps<T, Out extends Pass1Op>(
    input: T[],
    callback: (input: T) => Out
  ): Exclude<Out, pass1.Ignore>[] {
    return this.factory
      .map(input, callback)
      .filter((n: Out): n is Exclude<Out, pass1.Ignore> => n.name !== 'Ignore');
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

  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: PresentArray<T>,
    callback: (input: T) => E[]
  ): PresentArray<E>;
  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: Option<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Option<PresentArray<E>>;
  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: Option<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Option<PresentArray<E>> {
    if (input === null) {
      return null;
    } else {
      return this.factory.flatMap(input, callback) as PresentArray<E>;
    }
  }

  withBlock<T>(
    block: AST.Block | AST.ElementNode | AST.Template,
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

  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N]
  ): VisitorReturn<Pass0Expressions, N>;
  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N],
    context: ExpressionContext
  ): VisitorReturn<Pass0Expressions>;
  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N],
    context: ExpressionContext = ExpressionContext.Expression
  ): VisitorReturn<Pass0Expressions> {
    if (node.type === 'PathExpression') {
      return buildPathWithContext(this, node, context);
    } else {
      let f = this.expressions[node.type] as VisitorFunc<Pass0Expressions, N>;
      return f(node, this);
    }
  }

  visitAmbiguousStmt<N extends keyof Pass0Statements & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N]
  ): Exclude<VisitorReturn<Pass0Statements, N>, pass1.NamedBlock> {
    let f = this.statements[node.type] as VisitorFunc<Pass0Statements, N>;
    let result: pass1.Statement | pass1.Ignore | pass1.NamedBlock | pass1.TemporaryNamedBlock = f(
      node,
      this
    );

    assert(result.name !== 'NamedBlock', `Unexpected named block while evaluating statements`);

    return result as Exclude<VisitorReturn<Pass0Statements, N>, pass1.NamedBlock>;
  }

  visitStmt<N extends keyof Pass0Statements & AST.Statement['type']>(
    node: AST.Statement & { type: N }
  ): Exclude<VisitorReturn<Pass0Statements, N>, pass1.NamedBlock | pass1.TemporaryNamedBlock> {
    console.log(`pass0: visiting`, node);

    let f = this.statements[node.type] as VisitorFunc<Pass0Statements, N>;
    let result: pass1.Statement | pass1.Ignore | pass1.NamedBlock | pass1.TemporaryNamedBlock = f(
      node,
      this
    );

    console.log(`-> out   `, node);

    if (result.name === 'NamedBlock' || result.name === 'TemporaryNamedBlock') {
      throw new GlimmerSyntaxError(
        `Invalid named block whose parent is not a component invocation`,
        node.loc
      );
    }

    return result as Exclude<
      VisitorReturn<Pass0Statements, N>,
      pass1.NamedBlock | pass1.TemporaryNamedBlock
    >;
  }

  visitBlock(name: pass1.SourceSlice, node: AST.Block): pass1.NamedBlock {
    return this.withBlock(node, (symbols) =>
      this.op(pass1.NamedBlock, {
        name,
        table: symbols,
        body: this.mapIntoOps(node.body, (stmt) => this.visitStmt(stmt)),
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
    // @ts-expect-error FIXME
    return null;
  }

  return {
    start: startOffset,
    end: endOffset,
  };
}
