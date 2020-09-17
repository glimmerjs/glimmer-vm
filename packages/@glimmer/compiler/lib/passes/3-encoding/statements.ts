import { SexpOpcodes, WireFormat } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { SourceSlice } from '@glimmer/syntax';
import { Op, OpArgs, OpsTable } from '../../shared/op';
import { deflateTagName } from '../../utils';
import { visitExpr, visitInternal } from './expressions';
import * as mir from './mir';

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

export type VisitableStatement = mir.Op & { name: keyof StatementEncoder };

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

export class StatementEncoder implements Visitors<mir.StatementTable, OutOp> {
  Partial({ target, table }: OpArgs<mir.Partial>): WireFormat.Statements.Partial {
    return [SexpOpcodes.Partial, visitExpr(target), table.getEvalInfo()];
  }

  Debugger({ table }: OpArgs<mir.Debugger>): WireFormat.Statements.Debugger {
    return [SexpOpcodes.Debugger, table.getEvalInfo()];
  }

  Yield({ to, params }: OpArgs<mir.Yield>): WireFormat.Statements.Yield {
    return [SexpOpcodes.Yield, to, visitInternal(params)];
  }

  InElement({
    guid,
    insertBefore,
    destination,
    block,
  }: OpArgs<mir.InElement>): WireFormat.Statements.InElement {
    let wireBlock = visitInternal(block)[1];
    // let guid = args.guid;
    let wireDestination = visitExpr(destination);
    let wireInsertBefore = visitExpr(insertBefore);

    if (wireInsertBefore === undefined) {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination];
    } else {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination, wireInsertBefore];
    }
  }

  InvokeBlock({ head, args, blocks }: OpArgs<mir.InvokeBlock>): WireFormat.Statements.Block {
    return [SexpOpcodes.Block, visitExpr(head), ...visitInternal(args), visitInternal(blocks)];
  }

  AppendTrustedHTML({ html }: OpArgs<mir.AppendTrustedHTML>): WireFormat.Statements.TrustingAppend {
    return [SexpOpcodes.TrustingAppend, visitExpr(html)];
  }

  AppendTextNode({ text }: OpArgs<mir.AppendTextNode>): WireFormat.Statements.Append {
    return [SexpOpcodes.Append, visitExpr(text)];
  }

  AppendComment({ value }: OpArgs<mir.AppendComment>): WireFormat.Statements.Comment {
    return [SexpOpcodes.Comment, value.chars];
  }

  Modifier({ head, args }: OpArgs<mir.Modifier>): WireFormat.Statements.Modifier {
    return [SexpOpcodes.Modifier, visitExpr(head), ...visitInternal(args)];
  }

  SimpleElement({ tag, params, body, dynamicFeatures }: OpArgs<mir.SimpleElement>): WireStatements {
    let op = dynamicFeatures ? SexpOpcodes.OpenElementWithSplat : SexpOpcodes.OpenElement;
    return new WireStatements([
      [op, deflateTagName(tag.chars)],
      ...(visitInternal(params) || []),
      [SexpOpcodes.FlushElement],
      ...visitStatements(body),
      [SexpOpcodes.CloseElement],
    ]);
  }

  Component({ tag, params, args, blocks }: OpArgs<mir.Component>): WireFormat.Statements.Component {
    let wireTag = visitExpr(tag);
    let wirePositional = visitInternal(params);
    let wireNamed = visitInternal(args);

    let wireNamedBlocks = visitInternal(blocks);

    return [SexpOpcodes.Component, wireTag, wirePositional, wireNamed, wireNamedBlocks];
  }

  StaticArg({ name, value }: OpArgs<mir.StaticArg>): WireFormat.Statements.StaticArg {
    return [SexpOpcodes.StaticArg, name.chars, value.chars];
  }

  DynamicArg({ name, value }: OpArgs<mir.DynamicArg>): WireFormat.Statements.DynamicArg {
    return [SexpOpcodes.DynamicArg, name.chars, visitExpr(value)];
  }

  StaticSimpleAttr(args: OpArgs<mir.StaticSimpleAttr>): WireFormat.Statements.StaticAttr {
    return [SexpOpcodes.StaticAttr, ...staticAttr(args)];
  }

  StaticComponentAttr(
    args: OpArgs<mir.StaticComponentAttr>
  ): WireFormat.Statements.StaticComponentAttr {
    return [SexpOpcodes.StaticComponentAttr, ...staticAttr(args)];
  }

  ComponentAttr(args: OpArgs<mir.ComponentAttr>): WireFormat.Statements.ComponentAttr {
    return [SexpOpcodes.ComponentAttr, ...dynamicAttr(args)];
  }

  DynamicSimpleAttr(args: OpArgs<mir.DynamicSimpleAttr>): WireFormat.Statements.DynamicAttr {
    return [SexpOpcodes.DynamicAttr, ...dynamicAttr(args)];
  }

  TrustingComponentAttr(
    args: OpArgs<mir.TrustingComponentAttr>
  ): WireFormat.Statements.TrustingComponentAttr {
    return [SexpOpcodes.TrustingComponentAttr, ...dynamicAttr(args)];
  }

  TrustingDynamicAttr(
    args: OpArgs<mir.TrustingDynamicAttr>
  ): WireFormat.Statements.TrustingDynamicAttr {
    return [SexpOpcodes.TrustingDynamicAttr, ...dynamicAttr(args)];
  }

  AttrSplat({ symbol }: OpArgs<mir.AttrSplat>): WireFormat.Statements.AttrSplat {
    return [SexpOpcodes.AttrSplat, symbol];
  }
}

export const STATEMENTS = new StatementEncoder();

export function isStatement(input: mir.Op): input is mir.Statement {
  return input.name in STATEMENTS;
}

export type StaticAttrArgs = [name: string, value: string, namespace?: string];

function staticAttr({
  name,
  value,
  namespace,
}: {
  name: SourceSlice;
  value: SourceSlice;
  namespace?: string;
}): StaticAttrArgs {
  let out: StaticAttrArgs = [name.chars, value.chars];

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
  name: SourceSlice;
  value: mir.Expr;
  namespace?: string;
}): DynamicAttrArgs {
  let out: DynamicAttrArgs = [name.chars, visitExpr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}
