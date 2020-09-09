import { SexpOpcodes, WireFormat } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { Op, OpArgs, OpsTable } from '../../shared/op';
import { visitExpr, visitInternal } from './expressions';
import * as pass2 from './ops';

class WireStatements<S extends WireFormat.Statement = WireFormat.Statement> {
  constructor(private statements: S[]) {}

  toArray(): S[] {
    return this.statements;
  }
}

type OutOp = WireFormat.Statement | WireStatements;

export type Visitors<O extends OpsTable<Op>, Out extends OutOp | void = OutOp | void> = {
  [P in keyof O]: (args: OpArgs<O[P]>) => Out;
};

export type VisitableStatement = pass2.Op & { name: keyof StatementEncoder };

export function visitStatement<N extends VisitableStatement>(
  node: N
): ReturnType<StatementEncoder[N['name']]> {
  let f = STATEMENTS[node.name] as (
    _node: OpArgs<typeof node>
  ) => ReturnType<StatementEncoder[N['name']]>;
  return f(node.args as OpArgs<N>);
}

export function visitStatements(statements: VisitableStatement[]): WireFormat.Statement[] {
  let out: WireFormat.Statement[] = [];

  for (let statement of statements) {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`pass2: visiting`, statement);
    }

    let result = visitStatement(statement);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> pass2: out`, statements);
    }

    if (result instanceof WireStatements) {
      out.push(...result.toArray());
    } else {
      out.push(result);
    }
  }

  return out;
}

export class StatementEncoder implements Visitors<pass2.StatementTable, OutOp> {
  Partial({ target, table }: OpArgs<pass2.Partial>): WireFormat.Statements.Partial {
    return [SexpOpcodes.Partial, visitExpr(target), table.getEvalInfo()];
  }

  Debugger({ table }: OpArgs<pass2.Debugger>): WireFormat.Statements.Debugger {
    return [SexpOpcodes.Debugger, table.getEvalInfo()];
  }

  Yield({ to, params }: OpArgs<pass2.Yield>): WireFormat.Statements.Yield {
    return [SexpOpcodes.Yield, to, visitInternal(params)];
  }

  InElement({
    guid,
    insertBefore,
    destination,
    block,
  }: OpArgs<pass2.InElement>): WireFormat.Statements.InElement {
    let wireBlock = visitInternal(block)[1];
    // let guid = args.guid;
    let wireDestination = visitExpr(destination);
    let wireInsertBefore = visitExpr(insertBefore);

    if (wireInsertBefore === undefined) {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination];
    } else {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination, wireInsertBefore];
    }

    // return ctx.op(out.InElement, {
    //   guid,
    //   block: ctx.visit(block),
    //   insertBefore: ctx.visit(insertBefore),
    //   destination: ctx.visit(destination),
    // });
  }

  InvokeBlock({ head, args, blocks }: OpArgs<pass2.InvokeBlock>): WireFormat.Statements.Block {
    return [SexpOpcodes.Block, visitExpr(head), ...visitInternal(args), visitInternal(blocks)];
  }

  AppendTrustedHTML({
    html,
  }: OpArgs<pass2.AppendTrustedHTML>): WireFormat.Statements.TrustingAppend {
    return [SexpOpcodes.TrustingAppend, visitExpr(html)];
  }

  AppendTextNode({ text }: OpArgs<pass2.AppendTextNode>): WireFormat.Statements.Append {
    return [SexpOpcodes.Append, visitExpr(text)];
  }

  AppendComment({ value }: OpArgs<pass2.AppendComment>): WireFormat.Statements.Comment {
    return [SexpOpcodes.Comment, value];
  }

  Modifier({ head, args }: OpArgs<pass2.Modifier>): WireFormat.Statements.Modifier {
    // let head = ctx.popValue(EXPR);
    // let params = ctx.popValue(PARAMS);
    // let hash = ctx.popValue(HASH);

    return [SexpOpcodes.Modifier, visitExpr(head), ...visitInternal(args)];
  }

  // TODO Merge pass2.SimpleElement and pass2.ElementWithDynamicFeatures
  SimpleElement({
    tag,
    params,
    body,
    dynamicFeatures,
  }: OpArgs<pass2.SimpleElement>): WireStatements {
    let op = dynamicFeatures ? SexpOpcodes.OpenElementWithSplat : SexpOpcodes.OpenElement;
    return new WireStatements([
      [op, tag.args.value /* TODO deflate */],
      ...(visitInternal(params) || []),
      [SexpOpcodes.FlushElement],
      ...visitInternal(body)[1].statements,
      [SexpOpcodes.CloseElement],
    ]);
  }

  Component({
    tag,
    params,
    args,
    blocks,
  }: OpArgs<pass2.Component>): WireFormat.Statements.Component {
    let wireTag = visitExpr(tag);
    let wirePositional = visitInternal(params);
    let wireNamed = visitInternal(args);

    let wireNamedBlocks = visitInternal(blocks);

    return [SexpOpcodes.Component, wireTag, wirePositional, wireNamed, wireNamedBlocks];
  }

  StaticArg({ name, value }: OpArgs<pass2.StaticArg>): WireFormat.Statements.StaticArg {
    return [SexpOpcodes.StaticArg, visitInternal(name), visitInternal(value)];
  }

  DynamicArg({ name, value }: OpArgs<pass2.DynamicArg>): WireFormat.Statements.DynamicArg {
    return [SexpOpcodes.DynamicArg, visitInternal(name), visitExpr(value)];
  }

  StaticSimpleAttr(args: OpArgs<pass2.StaticSimpleAttr>): WireFormat.Statements.StaticAttr {
    return [SexpOpcodes.StaticAttr, ...staticAttr(args)];
  }

  StaticComponentAttr(
    args: OpArgs<pass2.StaticComponentAttr>
  ): WireFormat.Statements.StaticComponentAttr {
    return [SexpOpcodes.StaticComponentAttr, ...staticAttr(args)];
  }

  ComponentAttr(args: OpArgs<pass2.ComponentAttr>): WireFormat.Statements.ComponentAttr {
    return [SexpOpcodes.ComponentAttr, ...dynamicAttr(args)];
  }

  DynamicSimpleAttr(args: OpArgs<pass2.DynamicSimpleAttr>): WireFormat.Statements.DynamicAttr {
    return [SexpOpcodes.DynamicAttr, ...dynamicAttr(args)];
  }

  TrustingComponentAttr(
    args: OpArgs<pass2.TrustingComponentAttr>
  ): WireFormat.Statements.TrustingComponentAttr {
    return [SexpOpcodes.TrustingComponentAttr, ...dynamicAttr(args)];
  }

  TrustingDynamicAttr(
    args: OpArgs<pass2.TrustingDynamicAttr>
  ): WireFormat.Statements.TrustingDynamicAttr {
    return [SexpOpcodes.TrustingDynamicAttr, ...dynamicAttr(args)];
  }

  AttrSplat({ symbol }: OpArgs<pass2.AttrSplat>): WireFormat.Statements.AttrSplat {
    return [SexpOpcodes.AttrSplat, symbol];
  }
}

export const STATEMENTS = new StatementEncoder();

export function isStatement(input: pass2.Op): input is pass2.Statement {
  return input.name in STATEMENTS;
}

export type StaticAttrArgs = [name: string, value: string, namespace?: string];

function staticAttr({
  name,
  value,
  namespace,
}: {
  name: pass2.SourceSlice;
  value: pass2.SourceSlice;
  namespace?: string;
}): StaticAttrArgs {
  let out: StaticAttrArgs = [visitInternal(name), visitInternal(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

export type DynamicAttrArgs = [name: string, value: WireFormat.Expression, namespace?: string];

function dynamicAttr({
  name,
  value,
  namespace,
}: {
  name: pass2.SourceSlice;
  value: pass2.Expr;
  namespace?: string;
}): DynamicAttrArgs {
  let out: DynamicAttrArgs = [visitInternal(name), visitExpr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}
