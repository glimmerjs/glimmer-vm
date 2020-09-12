import {
  ExpressionContext,
  GetContextualFreeOp,
  PresentArray,
  SexpOpcodes,
  SexpOpcodes as WireOp,
  WireFormat,
} from '@glimmer/interfaces';
import { assertPresent, exhausted, isPresent, mapPresent } from '@glimmer/util';
import * as hir from '../pass1/hir';
import { Op, OpArgs, OpsTable } from '../../shared/op';
import * as pass2 from './ops';
import { visitStatement, visitStatements } from './statements';

export type HashPair = [string, WireFormat.Expression];

type OutOp = WireFormat.SyntaxWithInternal | HashPair | undefined;

export type Visitors<O extends OpsTable<Op>, Out extends OutOp | void = OutOp | void> = {
  [P in keyof O]: (args: OpArgs<O[P]>) => Out;
};

// function visit<N extends pass1.Internal & { name: keyof InternalEncoder }>(
//   node: N
// ): ReturnType<InternalEncoder[N['name']]> {
//   throw new Error('unimplemented');
// }

export function visitInternal<N extends pass2.Op & { name: keyof InternalEncoder }>(
  node: N
): ReturnType<InternalEncoder[N['name']]> {
  let f = INTERNAL[node.name] as (
    _node: OpArgs<typeof node>
  ) => ReturnType<InternalEncoder[N['name']]>;
  return f(node.args as OpArgs<N>);
}

export class InternalEncoder
  implements Visitors<pass2.InternalTable, WireFormat.SyntaxWithInternal> {
  ElementParameters({ body }: OpArgs<pass2.ElementParameters>): PresentArray<WireFormat.Parameter> {
    return mapPresent(body, (b) => visitStatement(b));
  }

  EmptyElementParameters(): null {
    return null;
  }

  SourceSlice(args: OpArgs<hir.SourceSlice>): string {
    return args.value;
  }

  Tail({ members }: OpArgs<pass2.Tail>): PresentArray<string> {
    return mapPresent(members, (member) => member.args.value);
  }

  NamedBlocks({ blocks }: OpArgs<pass2.NamedBlocks>): WireFormat.Core.Blocks {
    let names: string[] = [];
    let serializedBlocks: WireFormat.SerializedInlineBlock[] = [];

    for (let block of blocks) {
      let [name, serializedBlock] = visitInternal(block);

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    return [names, serializedBlocks];
  }

  EmptyNamedBlocks(): null {
    return null;
  }

  NamedBlock({ name, body, symbols }: OpArgs<pass2.NamedBlock>): WireFormat.Core.NamedBlock {
    return [
      visitInternal(name),
      {
        parameters: symbols.slots,
        statements: visitStatements(body),
      },
    ];
  }

  Args({ positional, named }: OpArgs<pass2.Args>): WireFormat.Core.Args {
    return [visitInternal(positional), visitInternal(named)];
  }

  Positional({ list }: OpArgs<pass2.Positional>): WireFormat.Core.Params {
    return list.map((l) => visitExpr(l)).toPresentArray();
  }

  EmptyPositional(): WireFormat.Core.Params {
    return null;
  }

  NamedArgument({ key, value }: OpArgs<pass2.NamedArgument>): HashPair {
    return [visitInternal(key), visitExpr(value)];
  }

  NamedArguments({ pairs }: OpArgs<pass2.NamedArguments>): WireFormat.Core.Hash {
    let list = pairs.toArray();

    if (isPresent(list)) {
      let names: string[] = [];
      let values: WireFormat.Expression[] = [];

      for (let pair of list) {
        let [name, value] = visitInternal(pair);
        names.push(name);
        values.push(value);
      }

      return [assertPresent(names), assertPresent(values)];
    } else {
      return null;
    }
  }
}

export const INTERNAL = new InternalEncoder();

export function isInternal(input: pass2.Op): input is pass2.Internal {
  return input.name in INTERNAL;
}

export function visitExpr<N extends pass2.Op & { name: keyof ExpressionEncoder }>(
  node: N
): ReturnType<ExpressionEncoder[N['name']]> {
  let f = EXPRESSIONS[node.name] as (
    _node: OpArgs<typeof node>
  ) => ReturnType<ExpressionEncoder[N['name']]>;
  return f(node.args as OpArgs<N>);
}

export class ExpressionEncoder
  implements Visitors<pass2.ExprTable, WireFormat.Expression | undefined> {
  Literal({
    value,
  }: OpArgs<pass2.Literal>): WireFormat.Expressions.Value | WireFormat.Expressions.Undefined {
    if (value === undefined) {
      return [SexpOpcodes.Undefined];
    } else {
      return value;
    }
  }

  Missing(): undefined {
    return undefined;
  }

  HasBlock({ symbol }: OpArgs<pass2.HasBlock>): WireFormat.Expressions.HasBlock {
    return [SexpOpcodes.HasBlock, [SexpOpcodes.GetSymbol, symbol]];
  }

  HasBlockParams({ symbol }: OpArgs<pass2.HasBlockParams>): WireFormat.Expressions.HasBlockParams {
    return [SexpOpcodes.HasBlockParams, [SexpOpcodes.GetSymbol, symbol]];
  }

  GetFreeWithContext({
    symbol,
    context,
  }: OpArgs<pass2.GetFreeWithContext>): WireFormat.Expressions.GetContextualFree {
    return [expressionContextOp(context), symbol];
  }

  GetFree({ symbol }: OpArgs<pass2.GetFree>): WireFormat.Expressions.GetFree {
    return [SexpOpcodes.GetFree, symbol];
  }

  GetWithResolver({
    symbol,
  }: OpArgs<pass2.GetWithResolver>): WireFormat.Expressions.GetContextualFree {
    return [SexpOpcodes.GetFreeInAppendSingleId, symbol];
  }

  GetSymbol({ symbol }: OpArgs<pass2.GetSymbol>): WireFormat.Expressions.GetSymbol {
    return [SexpOpcodes.GetSymbol, symbol];
  }

  GetPath({ head, tail }: OpArgs<pass2.GetPath>): WireFormat.Expressions.GetPath {
    return [SexpOpcodes.GetPath, visitExpr(head), visitInternal(tail)];
  }

  Concat({ parts }: OpArgs<pass2.Concat>): WireFormat.Expressions.Concat {
    return [SexpOpcodes.Concat, visitInternal(parts) as PresentArray<WireFormat.Expression>];
  }

  Helper({ head, args }: OpArgs<pass2.Helper>): WireFormat.Expressions.Helper {
    // let head = ctx.popValue(EXPR);
    // let params = ctx.popValue(PARAMS);
    // let hash = ctx.popValue(HASH);

    return [SexpOpcodes.Call, visitExpr(head), ...visitInternal(args)];
  }
}

export const EXPRESSIONS = new ExpressionEncoder();

export function isExpr(input: pass2.Op): input is pass2.Expr {
  return input.name in EXPRESSIONS;
}

export function expressionContextOp(context: ExpressionContext): GetContextualFreeOp {
  switch (context) {
    case ExpressionContext.Ambiguous:
      return WireOp.GetFreeInAppendSingleId;
    case ExpressionContext.WithoutResolver:
      return WireOp.GetFreeInExpression;
    case ExpressionContext.ResolveAsCallHead:
      return WireOp.GetFreeInCallHead;
    case ExpressionContext.ResolveAsBlockHead:
      return WireOp.GetFreeInBlockHead;
    case ExpressionContext.ResolveAsModifierHead:
      return WireOp.GetFreeInModifierHead;
    case ExpressionContext.ResolveAsComponentHead:
      return WireOp.GetFreeInComponentHead;
    default:
      return exhausted(context);
  }
}
