import type { PresentArray, WireFormat } from '@glimmer/interfaces';
import type { ASTv2 } from '@glimmer/syntax';
import { assert, assertPresentArray, isPresentArray, mapPresentArray } from '@glimmer/debug-util';
import {
  WF_CALL_OPCODE,
  WF_CONCAT_OPCODE,
  WF_CURRY_OPCODE,
  WF_GET_DYNAMIC_VAR_OPCODE,
  WF_GET_LEXICAL_SYMBOL_OPCODE,
  WF_GET_STRICT_KEYWORD_OPCODE,
  WF_GET_SYMBOL_OPCODE,
  WF_HAS_BLOCK_OPCODE,
  WF_HAS_BLOCK_PARAMS_OPCODE,
  WF_IF_INLINE_OPCODE,
  WF_LOG_OPCODE,
  WF_NOT_OPCODE,
  WF_UNDEFINED_OPCODE,
} from '@glimmer/wire-format';

import type * as mir from './mir';

type HashPair = [string, WireFormat.Expression];

class ExpressionEncoder {
  expr(expr: mir.ExpressionNode): WireFormat.Expression {
    switch (expr.type) {
      case 'Missing':
        return undefined;
      case 'Literal':
        return this.Literal(expr);
      case 'Keyword':
        return this.Keyword(expr);
      case 'CallExpression':
        return this.CallExpression(expr);
      case 'PathExpression':
        return this.PathExpression(expr);
      case 'Arg':
        return [WF_GET_SYMBOL_OPCODE, expr.symbol];
      case 'Local':
        return this.Local(expr);
      case 'This':
        return [WF_GET_SYMBOL_OPCODE, 0];
      case 'Free':
        return [expr.resolution.resolution(), expr.symbol];
      case 'HasBlock':
        return this.HasBlock(expr);
      case 'HasBlockParams':
        return this.HasBlockParams(expr);
      case 'Curry':
        return this.Curry(expr);
      case 'Not':
        return this.Not(expr);
      case 'IfInline':
        return this.IfInline(expr);
      case 'InterpolateExpression':
        return this.InterpolateExpression(expr);
      case 'GetDynamicVar':
        return this.GetDynamicVar(expr);
      case 'Log':
        return this.Log(expr);
    }
  }

  Literal({
    value,
  }: ASTv2.LiteralExpression): WireFormat.Expressions.Value | WireFormat.Expressions.Undefined {
    if (value === undefined) {
      return [WF_UNDEFINED_OPCODE];
    } else {
      return value;
    }
  }

  Missing(): undefined {
    return undefined;
  }

  HasBlock({ symbol }: mir.HasBlock): WireFormat.Expressions.HasBlock {
    return [WF_HAS_BLOCK_OPCODE, [WF_GET_SYMBOL_OPCODE, symbol]];
  }

  HasBlockParams({ symbol }: mir.HasBlockParams): WireFormat.Expressions.HasBlockParams {
    return [WF_HAS_BLOCK_PARAMS_OPCODE, [WF_GET_SYMBOL_OPCODE, symbol]];
  }

  Curry({ definition, curriedType, args }: mir.Curry): WireFormat.Expressions.Curry {
    return [
      WF_CURRY_OPCODE,
      EXPR.expr(definition),
      curriedType,
      EXPR.Positional(args.positional),
      EXPR.NamedArguments(args.named),
    ];
  }

  Local({
    isTemplateLocal,
    symbol,
  }: ASTv2.LocalVarReference):
    | WireFormat.Expressions.GetSymbol
    | WireFormat.Expressions.GetLexicalSymbol {
    return [isTemplateLocal ? WF_GET_LEXICAL_SYMBOL_OPCODE : WF_GET_SYMBOL_OPCODE, symbol];
  }

  Keyword({ symbol }: ASTv2.KeywordExpression): WireFormat.Expressions.GetStrictFree {
    return [WF_GET_STRICT_KEYWORD_OPCODE, symbol];
  }

  PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.GetPath {
    let getOp = EXPR.expr(head) as WireFormat.Expressions.GetVar;
    assert(getOp[0] !== WF_GET_STRICT_KEYWORD_OPCODE, '[BUG] keyword in a PathExpression');
    return [...getOp, EXPR.Tail(tail)];
  }

  InterpolateExpression({ parts }: mir.InterpolateExpression): WireFormat.Expressions.Concat {
    return [WF_CONCAT_OPCODE, parts.map((e) => EXPR.expr(e)).toArray()];
  }

  CallExpression({ callee, args }: mir.CallExpression): WireFormat.Expressions.Helper {
    return [WF_CALL_OPCODE, EXPR.expr(callee), ...EXPR.Args(args)];
  }

  Tail({ members }: mir.Tail): PresentArray<string> {
    return mapPresentArray(members, (member) => member.chars);
  }

  Args({ positional, named }: mir.Args): WireFormat.Core.Args {
    return [this.Positional(positional), this.NamedArguments(named)];
  }

  Positional({ list }: mir.Positional): WireFormat.Core.Params {
    return list.map((l) => EXPR.expr(l)).toPresentArray();
  }

  NamedArgument({ key, value }: mir.NamedArgument): HashPair {
    return [key.chars, EXPR.expr(value)];
  }

  NamedArguments({ entries: pairs }: mir.NamedArguments): WireFormat.Core.Hash {
    let list = pairs.toArray();

    if (isPresentArray(list)) {
      let names: string[] = [];
      let values: WireFormat.Expression[] = [];

      for (let pair of list) {
        let [name, value] = EXPR.NamedArgument(pair);
        names.push(name);
        values.push(value);
      }

      assertPresentArray(names);
      assertPresentArray(values);

      return [names, values];
    } else {
      return null;
    }
  }

  Not({ value }: mir.Not): WireFormat.Expressions.Not {
    return [WF_NOT_OPCODE, EXPR.expr(value)];
  }

  IfInline({ condition, truthy, falsy }: mir.IfInline): WireFormat.Expressions.IfInline {
    let expr = [WF_IF_INLINE_OPCODE, EXPR.expr(condition), EXPR.expr(truthy)];

    if (falsy) {
      expr.push(EXPR.expr(falsy));
    }

    return expr as WireFormat.Expressions.IfInline;
  }

  GetDynamicVar({ name }: mir.GetDynamicVar): WireFormat.Expressions.GetDynamicVar {
    return [WF_GET_DYNAMIC_VAR_OPCODE, EXPR.expr(name)];
  }

  Log({ positional }: mir.Log): WireFormat.Expressions.Log {
    return [WF_LOG_OPCODE, this.Positional(positional)];
  }
}

export const EXPR: ExpressionEncoder = new ExpressionEncoder();
