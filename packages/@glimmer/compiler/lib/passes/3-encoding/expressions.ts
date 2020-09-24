import { Optional, PresentArray, SexpOpcodes, WireFormat } from '@glimmer/interfaces';
import { assertPresent, isPresent, mapPresent } from '@glimmer/util';

import { Op, OpArgs, OpsTable } from '../../shared/op';
import * as mir from './mir';
import { visitStatement, visitStatements } from './statements';

export type HashPair = [string, WireFormat.Expression];

type OutOp = WireFormat.SyntaxWithInternal | HashPair | undefined;

export type Visitors<O extends OpsTable<Op>, Out extends OutOp | void = OutOp | void> = {
  [P in keyof O]: (args: OpArgs<O[P]>) => Out;
};

// function visit<N extends hir.Internal & { name: keyof InternalEncoder }>(
//   node: N
// ): ReturnType<InternalEncoder[N['name']]> {
//   throw new Error('unimplemented');
// }

export function visitInternal<N extends mir.Op & { name: keyof InternalEncoder }>(
  node: N
): ReturnType<InternalEncoder[N['name']]> {
  let f = INTERNAL[node.name] as (
    _node: OpArgs<typeof node>
  ) => ReturnType<InternalEncoder[N['name']]>;
  return f(node.args as OpArgs<N>);
}

export class InternalEncoder implements Visitors<mir.InternalTable, WireFormat.SyntaxWithInternal> {
  ElementParameters({
    body,
  }: OpArgs<mir.ElementParameters>): Optional<PresentArray<WireFormat.Parameter>> {
    return body.into({
      ifPresent: (body) => body.map(visitStatement).toPresentArray(),
      ifEmpty: () => null,
    });
  }

  Tail({ members }: OpArgs<mir.Tail>): PresentArray<string> {
    return mapPresent(members, (member) => member.chars);
  }

  NamedBlocks({ blocks }: OpArgs<mir.NamedBlocks>): WireFormat.Core.Blocks {
    let names: string[] = [];
    let serializedBlocks: WireFormat.SerializedInlineBlock[] = [];

    for (let block of blocks.toArray()) {
      let [name, serializedBlock] = visitInternal(block);

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    return [names, serializedBlocks];
  }

  NamedBlock({ name, body, symbols }: OpArgs<mir.NamedBlock>): WireFormat.Core.NamedBlock {
    return [
      name.chars,
      {
        parameters: symbols.slots,
        statements: visitStatements(body),
      },
    ];
  }

  Args({ positional, named }: OpArgs<mir.Args>): WireFormat.Core.Args {
    return [visitInternal(positional), visitInternal(named)];
  }

  Positional({ list }: OpArgs<mir.Positional>): WireFormat.Core.Params {
    return list.map((l) => visitExpr(l)).toPresentArray();
  }

  NamedArgument({ key, value }: OpArgs<mir.NamedArgument>): HashPair {
    return [key.chars, visitExpr(value)];
  }

  NamedArguments({ pairs }: OpArgs<mir.NamedArguments>): WireFormat.Core.Hash {
    let list = pairs.toArray();

    if (isPresent(list)) {
      let names: string[] = [];
      let values: WireFormat.Expression[] = [];

      for (let pair of list) {
        let [name, value] = visitInternal(pair);
        names.push(name);
        values.push(value);
      }

      assertPresent(names);
      assertPresent(values);

      return [names, values];
    } else {
      return null;
    }
  }
}

export const INTERNAL = new InternalEncoder();

export function isInternal(input: mir.Op): input is mir.Internal {
  return input.name in INTERNAL;
}

export function visitExpr<N extends mir.Op & { name: keyof ExpressionEncoder }>(
  node: N
): ReturnType<ExpressionEncoder[N['name']]> {
  let f = EXPRESSIONS[node.name] as (
    _node: OpArgs<typeof node>
  ) => ReturnType<ExpressionEncoder[N['name']]>;
  return f(node.args as OpArgs<N>);
}

export class ExpressionEncoder
  implements Visitors<mir.ExprTable, WireFormat.Expression | undefined> {
  Literal({
    value,
  }: OpArgs<mir.Literal>): WireFormat.Expressions.Value | WireFormat.Expressions.Undefined {
    if (value === undefined) {
      return [SexpOpcodes.Undefined];
    } else {
      return value;
    }
  }

  Missing(): undefined {
    return undefined;
  }

  HasBlock({ symbol }: OpArgs<mir.HasBlock>): WireFormat.Expressions.HasBlock {
    return [SexpOpcodes.HasBlock, [SexpOpcodes.GetSymbol, symbol]];
  }

  HasBlockParams({ symbol }: OpArgs<mir.HasBlockParams>): WireFormat.Expressions.HasBlockParams {
    return [SexpOpcodes.HasBlockParams, [SexpOpcodes.GetSymbol, symbol]];
  }

  GetFreeWithContext({
    symbol,
    context,
  }: OpArgs<mir.GetFreeWithContext>):
    | WireFormat.Expressions.GetContextualFree
    | WireFormat.Expressions.GetStrictFree {
    return [context.resolution(), symbol];
  }

  GetFree({ symbol }: OpArgs<mir.GetFree>): WireFormat.Expressions.GetStrictFree {
    return [SexpOpcodes.GetStrictFree, symbol];
  }

  GetWithResolver({
    symbol,
  }: OpArgs<mir.GetWithResolver>): WireFormat.Expressions.GetContextualFree {
    return [SexpOpcodes.GetFreeAsComponentOrHelperHeadOrThisFallback, symbol];
  }

  GetSymbol({ symbol }: OpArgs<mir.GetSymbol>): WireFormat.Expressions.GetSymbol {
    return [SexpOpcodes.GetSymbol, symbol];
  }

  GetPath({ head, tail }: OpArgs<mir.GetPath>): WireFormat.Expressions.GetPath {
    return [SexpOpcodes.GetPath, visitExpr(head), visitInternal(tail)];
  }

  Concat({ parts }: OpArgs<mir.Concat>): WireFormat.Expressions.Concat {
    return [SexpOpcodes.Concat, visitInternal(parts) as PresentArray<WireFormat.Expression>];
  }

  Helper({ head, args }: OpArgs<mir.Helper>): WireFormat.Expressions.Helper {
    // let head = ctx.popValue(EXPR);
    // let params = ctx.popValue(PARAMS);
    // let hash = ctx.popValue(HASH);

    return [SexpOpcodes.Call, visitExpr(head), ...visitInternal(args)];
  }
}

export const EXPRESSIONS = new ExpressionEncoder();

export function isExpr(input: mir.Op): input is mir.Expr {
  return input.name in EXPRESSIONS;
}
