import { PresentArray, SexpOpcodes } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { assert, assertPresent, isPresent, mapPresent, unreachable } from '@glimmer/util';
import { packed } from '@glimmer/wire-format';

import * as mir from '../2-encoding/mir';

interface Allow {
  shorthandStrings: boolean;
  interpolate: boolean;
}

export const INTERPOLATE = { shorthandStrings: true, interpolate: true } as const;
export type INTERPOLATE = typeof INTERPOLATE;
export const LONGHAND = { shorthandStrings: false, interpolate: false } as const;
export type LONGHAND = typeof LONGHAND;
export const PACKED = { shorthandStrings: true, interpolate: false } as const;
export type PACKED = typeof PACKED;

export class ExpressionEncoder {
  expr(expr: mir.ExpressionNode, allow: LONGHAND): packed.expr.LonghandExpression;
  expr(expr: mir.ExpressionNode, allow: INTERPOLATE): packed.Expression | packed.expr.Interpolate;
  expr(expr: mir.ExpressionNode, allow: PACKED): packed.Expression;
  expr(
    expr: mir.ExpressionNode,
    allow: Allow = PACKED
  ): packed.Expression | packed.expr.Interpolate {
    switch (expr.type) {
      case 'Missing':
        return packed.LiteralValue.Undefined;
      case 'Literal':
        return EXPR.Literal(expr, allow);
      case 'CallExpression':
        return EXPR.CallExpression(expr);
      case 'PathExpression':
        return EXPR.PathExpression(expr);
      case 'InterpolateExpression':
        assert(
          allow.interpolate,
          `\`Interpolate\` found even though interpolate: true wasn't passed`
        );
        return EXPR.InterpolateExpression(expr);
      case 'Arg':
      case 'Local':
        return [packed.ExprOp.GetSymbol, expr.symbol];
      case 'This':
        return packed.ExprOp.GetThis;
      case 'Free':
        return EXPR.Free(expr);
      case 'HasBlock':
        return EXPR.HasBlock(expr, allow);
      case 'HasBlockParams':
        return EXPR.HasBlockParams(expr, allow);
    }
  }

  Literal({ value }: ASTv2.LiteralExpression, allow: Allow): packed.expr.Literal {
    switch (value) {
      case null:
        return packed.expr.LiteralValue.Null;
      case undefined:
        return packed.expr.LiteralValue.Undefined;
      case true:
        return packed.expr.LiteralValue.True;
      case false:
        return packed.expr.LiteralValue.False;

      default:
        switch (typeof value) {
          case 'string':
            return allow.shorthandStrings
              ? packed.expr.string(value)
              : [packed.SpecialExpr.Literal, value];
          case 'number':
            return allow.shorthandStrings
              ? packed.expr.number(value)
              : [packed.SpecialExpr.Literal, value];

          default:
            throw unreachable();
        }
    }
  }

  Missing(): packed.expr.Undefined {
    return 1;
  }

  HasBlock({ symbol, target }: mir.HasBlock, allow: LONGHAND): packed.expr.FullHasBlock;
  HasBlock({ symbol, target }: mir.HasBlock, allow: Allow): packed.expr.HasBlock;
  HasBlock({ symbol, target }: mir.HasBlock, allow: Allow): packed.expr.HasBlock {
    if (target.chars === 'default') {
      return allow.shorthandStrings
        ? packed.expr.SpecialExpr.HasBlock
        : [packed.SpecialExpr.HasBlock];
    } else {
      return [packed.expr.SpecialExpr.HasBlock, symbol];
    }
  }

  HasBlockParams(
    { symbol, target }: mir.HasBlockParams,
    allow: LONGHAND
  ): packed.expr.FullHasBlockParams;
  HasBlockParams({ symbol, target }: mir.HasBlockParams, allow: Allow): packed.expr.HasBlockParams;
  HasBlockParams({ symbol, target }: mir.HasBlockParams, allow: Allow): packed.expr.HasBlockParams {
    if (target.chars === 'default') {
      return allow.shorthandStrings
        ? packed.expr.SpecialExpr.HasBlockParams
        : [packed.SpecialExpr.HasBlockParams];
    } else {
      return [packed.expr.SpecialExpr.HasBlockParams, symbol];
    }
  }

  Free({ symbol: upvar, resolution }: ASTv2.FreeVarReference): packed.Expression {
    switch (resolution.resolution()) {
      case SexpOpcodes.GetFreeAsComponentOrHelperHeadOrThisFallback:
        return [packed.ExprOp.GetLooseHelperOrComponent, upvar];
      case SexpOpcodes.GetFreeAsComponentOrHelperHead:
        return [
          packed.ExprOp.GetNamespacedFree,
          upvar,
          packed.expr.VariableNamespace.HelperOrComponent,
        ] as packed.expr.GetNamespacedFree;
      case SexpOpcodes.GetFreeAsHelperHeadOrThisFallback:
        return [packed.ExprOp.GetLooseHelper, upvar];
      case SexpOpcodes.GetFreeAsHelperHead:
        return [packed.ExprOp.GetNamespacedFree, upvar, packed.expr.VariableNamespace.Helper];
      case SexpOpcodes.GetFreeAsModifierHead:
        return [packed.ExprOp.GetNamespacedFree, upvar, packed.expr.VariableNamespace.Modifier];

      case SexpOpcodes.GetFreeAsComponentHead:
        return [packed.ExprOp.GetNamespacedFree, upvar, packed.expr.VariableNamespace.Component];

      case SexpOpcodes.GetFreeAsFallback:
        return [packed.ExprOp.GetLooseHelperOrComponent, upvar];
      case SexpOpcodes.GetStrictFree:
        return [packed.ExprOp.GetNamespacedFree, upvar];
    }
  }

  GetSymbol({ symbol }: mir.GetSymbol): packed.expr.GetSymbol {
    return [packed.ExprOp.GetSymbol, symbol];
  }

  PathExpression({ head, tail }: mir.PathExpression): packed.expr.GetPath {
    let [first, ...rest] = tail.members;

    if (isPresent(rest)) {
      return [
        packed.ExprOp.GetPath,
        EXPR.expr(head, PACKED),
        first.chars,
        ...tail.members.map((t) => t.chars),
      ];
    } else {
      return [packed.ExprOp.GetPath, EXPR.expr(head, PACKED), first.chars];
    }
  }

  InterpolateExpression({ parts }: mir.InterpolateExpression): packed.expr.Interpolate {
    return [
      packed.expr.SpecialExpr.Interpolate,
      ...parts.map((e) => EXPR.expr(e, PACKED)).toArray(),
    ];
  }

  CallExpression({ callee, args }: mir.CallExpression | mir.Modifier): packed.expr.Invoke {
    let packedCallee = EXPR.expr(callee, PACKED);
    let positional = EXPR.Positional(args.positional);
    let named = EXPR.NamedArguments(args.named);

    let hasPositional = positional !== 0;
    let hasNamed = named !== 0;

    if (hasPositional) {
      return hasNamed
        ? [packed.ExprOp.Invoke, packedCallee, positional, named]
        : [packed.ExprOp.Invoke, packedCallee, positional];
    } else {
      return hasNamed
        ? [packed.ExprOp.InvokeNamed, packedCallee, named]
        : [packed.ExprOp.Invoke, packedCallee];
    }
  }

  Tail({ members }: mir.Tail): PresentArray<string> {
    return mapPresent(members, (member) => member.chars);
  }

  Args({ positional, named }: mir.Args): packed.expr.Args {
    return [this.Positional(positional), this.NamedArguments(named)];
  }

  Positional({ list }: mir.Positional): packed.expr.PositionalArguments {
    let arr = list.map((l) => EXPR.expr(l, PACKED)).toPresentArray();

    if (arr === null) {
      return 0;
    } else {
      return arr;
    }
  }

  // NamedArgument({ key, value }: mir.NamedArgument): HashPair {
  //   return [key.chars, EXPR.expr(value)];
  // }

  NamedArguments({ entries: pairs }: mir.NamedArguments): packed.expr.NamedArguments {
    let list = pairs.toArray();

    if (isPresent(list)) {
      let names: string[] = [];
      let values: packed.Expression[] = [];

      for (let { key, value } of list) {
        names.push(key.chars);
        values.push(EXPR.expr(value, PACKED));
      }

      assertPresent(names);
      assertPresent(values);

      return [names.join('|'), ...values];
    } else {
      return 0;
    }
  }
}

export const EXPR = new ExpressionEncoder();
