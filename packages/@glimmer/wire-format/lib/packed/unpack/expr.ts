import { assertNever, unreachable } from '@glimmer/util';
import { PresentArray } from '@glimmer/interfaces';
import { ElementModifier } from '../content';
import {
  Expression,
  ExprOp,
  InvokeN,
  LiteralValue,
  LonghandExpression,
  NamedArguments,
  Null,
  PositionalArguments,
  SpecialExpr,
  UnambiguousExpression,
  VariableNamespace,
} from '../expr';
import { combine, Scope } from './shared';

export interface ExprOutput {
  expr: unknown;
  HasBlock: unknown;
  HasBlockParams: unknown;
  Literal: unknown;
  GetThis: unknown;
  GetSymbol: unknown;
  GetNamespacedFree: unknown;
  GetStrictFree: unknown;
  GetLooseAttr: unknown;
  GetLooseAppend: unknown;
  GetPath: unknown;
  Invoke: unknown;
  positionalArguments: unknown;
  namedArguments: unknown;
  args: unknown;
}

interface UnpackExpr<O extends ExprOutput> {
  hasBlock(symbol: number | undefined): O['HasBlock'];
  hasBlockParams(symbol: number | undefined): O['HasBlockParams'];
  literal(value: null | undefined | boolean | string | number): O['Literal'];
  getThis(): O['GetThis'];
  getSymbol(value: number): O['GetSymbol'];
  getNamespacedFree(upvar: number, namespace: VariableNamespace): O['GetNamespacedFree'];
  getStrictFree(upvar: number): O['GetStrictFree'];
  getLooseAttr(upvar: number): O['GetLooseAttr'];
  getLooseAppend(upvar: number): O['GetLooseAppend'];
  getPath(head: O['expr'], tail: PresentArray<string>): O['GetPath'];
  invoke(callee: O['expr'], args: O['args']): O['Invoke'];
  positional(positional: null | O['expr'][]): O['positionalArguments'];
  namedArguments(positional: null | [string, O['expr']][]): O['namedArguments'];
  args(positional: null | O['positionalArguments'], named: null | O['namedArguments']): O['args'];
}

export interface ExprDebugOutput {
  expr: ExpressionDebug;
  HasBlock: HasBlockDebug;
  HasBlockParams: HasBlockParamsDebug;
  Literal: null | undefined | boolean | string | number;
  GetThis: 'this';
  GetSymbol: string;
  GetNamespacedFree: string;
  GetStrictFree: string;
  GetLooseAttr: string;
  GetLooseAppend: string;
  GetPath: PathDebug;
  Invoke: CallDebug;
  positionalArguments: PositionalDebug;
  namedArguments: NamedArgumentsDebug;
  args: ArgsDebug;
}

class ExprDebugDecoder implements UnpackExpr<ExprDebugOutput> {
  constructor(private scope: Scope) {}

  hasBlock(symbol: number | undefined): HasBlockDebug {
    if (symbol === undefined) {
      return '%has-block';
    } else {
      return ['%has-block', this.scope.upvars[symbol]];
    }
  }

  hasBlockParams(symbol: number | undefined): HasBlockParamsDebug {
    if (symbol === undefined) {
      return '%has-block-params';
    } else {
      return ['%has-block-params', this.scope.upvars[symbol]];
    }
  }

  literal(
    value: string | number | boolean | null | undefined
  ): string | number | boolean | null | undefined {
    return value;
  }

  getThis(): 'this' {
    return 'this';
  }

  getSymbol(value: number): string {
    return this.scope.symbols[value];
  }

  getNamespacedFree(upvar: number, namespace: VariableNamespace): string {
    return `${varNamespace(namespace)}::${this.scope.upvars[upvar]}`;
  }

  getStrictFree(upvar: number): string {
    return `!${this.scope.upvars[upvar]}`;
  }

  getLooseAttr(upvar: number): string {
    return `attr?::${this.scope.upvars[upvar]}`;
  }

  getLooseAppend(upvar: number): string {
    return `append?::${this.scope.upvars[upvar]}`;
  }

  getPath(head: ExpressionDebug, tail: string[]): PathDebug {
    return ['.', head, tail.join('.')];
  }

  invoke(callee: ExpressionDebug, args: ArgsDebug): CallDebug {
    return ['()', callee, ...args];
  }

  positional(positional: ExpressionDebug[] | null): PositionalDebug {
    return positional;
  }

  namedArguments(
    named: [string, ExpressionDebug][] | null
  ): Record<string, ExpressionDebug> | null {
    if (named === null) {
      return null;
    }

    let o: Record<string, ExpressionDebug> = {};

    for (let [key, value] of named) {
      o[key] = value;
    }

    return o;
  }

  args(positional: PositionalDebug, named: Record<string, ExpressionDebug>): ArgsDebug {
    return combine(positional, named);
  }
}

const NONE = Object.freeze({ none: true });
type NONE = typeof NONE;

export class ExprDecoder<O extends ExprOutput> {
  constructor(private scope: Scope, readonly decoder: UnpackExpr<O>) {}

  expr(e: Expression): O['expr'] {
    if (isLonghand(e)) {
      return this.longhand(e);
    }

    // shorthand HasBlock
    if (e === SpecialExpr.HasBlock) {
      return this.decoder.hasBlock(undefined);
    }

    // shorthand HasBlockParams
    if (e === SpecialExpr.HasBlockParams) {
      return this.decoder.hasBlockParams(undefined);
    }

    if (typeof e === 'number') {
      let literal = this.literal(e);

      if (literal === NONE) {
        throw unreachable('packed numbers are always literals');
      } else {
        return literal;
      }
    }

    if (typeof e === 'string') {
      switch (e[0]) {
        case ':':
          // shorthand string
          return e.slice(1);
        case '|':
          // shorthand number
          return parseFloat(e.slice(1));
        default:
          throw unreachable('should have handled all string expressions');
      }
    }

    assertNever(e);
  }

  private literal(e: number): O['Literal'] | NONE {
    switch (e) {
      case LiteralValue.Null:
        return this.decoder.literal(null);
      case LiteralValue.Undefined:
        return this.decoder.literal(undefined);
      case LiteralValue.True:
        return this.decoder.literal(true);
      case LiteralValue.False:
        return this.decoder.literal(false);
      default:
        return NONE;
    }
  }

  private longhand(e: LonghandExpression): O['expr'] {
    switch (e[0]) {
      case ExprOp.GetThis:
        return this.decoder.getThis();
      case SpecialExpr.HasBlock:
        return e.length === 1 ? this.decoder.hasBlock(undefined) : this.decoder.hasBlock(e[1]);
      case SpecialExpr.HasBlockParams:
        return e.length === 1
          ? this.decoder.hasBlockParams(undefined)
          : this.decoder.hasBlockParams(e[1]);
      case SpecialExpr.Literal:
        if (typeof e[1] === 'string') {
          return this.decoder.literal(e[1]);
        } else {
          let literal = this.literal(e[1]);

          if (literal === NONE) {
            return this.literal(e[1] - LiteralValue.Offset);
          } else {
            return literal;
          }
        }

      default:
        return this.unambiguousExpression(e);
    }
  }

  private unambiguousExpression(e: UnambiguousExpression): O['expr'] {
    switch (e[0]) {
      case ExprOp.GetSymbol:
        return this.decoder.getSymbol(e[1]);
      case ExprOp.GetNamespacedFree:
        if (e.length === 3) {
          return this.decoder.getNamespacedFree(e[1], e[2]);
        } else {
          return this.decoder.getStrictFree(e[1]);
        }
      case ExprOp.GetLooseHelper:
        return this.decoder.getLooseAttr(e[1]);
      case ExprOp.GetLooseHelperOrComponent:
        return this.decoder.getLooseAppend(e[1]);

      case ExprOp.GetPath: {
        if (e.length > 3) {
          return ['.', this.expr(e[1]), e[2]];
        } else {
          return ['.', this.expr(e[1]), e.slice(2).join('.')];
        }
      }

      case ExprOp.Invoke: {
        return this.invokeN(e);
      }

      case ExprOp.InvokeNamed: {
        return this.decoder.invoke(this.expr(e[1]), this.args(undefined, e[2]));
      }
    }
  }

  private invokeN(e: InvokeN | ElementModifier): O['Invoke'] {
    return this.decoder.invoke(this.expr(e[1]), this.args(e[2], e[3]));
  }

  private positional(p: PositionalArguments | undefined): O['positionalArguments'] {
    if (p === Null || p === undefined) {
      return this.decoder.positional(null);
    } else {
      return this.decoder.positional(p.map((e) => this.expr(e)));
    }
  }

  namedArguments(p: NamedArguments | undefined): [string, O['expr']][] | null {
    if (p === Null || p === undefined) {
      return null;
    }

    let o: [string, O['expr']][] = [];
    let names = p[0].split('|');

    names.forEach((n, i) => o.push([n, this.expr(p[i + 1])]));

    return o;
  }

  args(p: PositionalArguments | undefined, n: NamedArguments | undefined): O['args'] {
    return this.decoder.args(this.positional(p), this.namedArguments(n));
  }
}

export type CallDebug =
  | ['()', ExpressionDebug]
  | ['()', ExpressionDebug, PositionalDebug]
  | ['()', ExpressionDebug, NamedArgumentsDebug]
  | ['()', ExpressionDebug, PositionalDebug, NamedArgumentsDebug];

export type PathDebug = ['.', ExpressionDebug, string];

export type UnambiguousExpressionDebug = string | 'this' | PathDebug | CallDebug;

export type ArgsDebug =
  | []
  | [PositionalDebug]
  | [NamedArgumentsDebug]
  | [PositionalDebug, NamedArgumentsDebug];

export type PositionalDebug = ExpressionDebug[] | null;

export type NamedArgumentsDebug = Record<string, ExpressionDebug> | null;

type HasBlockDebug = '%has-block' | ['%has-block', ExpressionDebug];
type HasBlockParamsDebug = '%has-block-params' | ['%has-block-params', ExpressionDebug];

export type ExpressionDebug =
  | UnambiguousExpressionDebug
  | HasBlockDebug
  | HasBlockParamsDebug
  | null
  | undefined
  | boolean
  | string
  | number;

function isLonghand(e: Expression): e is LonghandExpression {
  return (
    e !== ExprOp.GetThis &&
    e !== SpecialExpr.HasBlock &&
    e !== SpecialExpr.HasBlockParams &&
    typeof e !== 'string'
  );
}

function varNamespace(ns: VariableNamespace): string {
  switch (ns) {
    case VariableNamespace.Component:
      return 'component';
    case VariableNamespace.Helper:
      return 'helper';
    case VariableNamespace.Modifier:
      return 'modifier';
    case VariableNamespace.HelperOrComponent:
      return 'append';
  }
}
