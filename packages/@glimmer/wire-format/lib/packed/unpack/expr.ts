import { PresentArray } from '@glimmer/interfaces';
import { assertNever, mapPresent, unreachable } from '@glimmer/util';
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

export declare abstract class ExprOutput {
  abstract expr: unknown;
  abstract HasBlock: unknown;
  abstract HasBlockParams: unknown;
  abstract Literal: unknown;
  abstract GetThis: unknown;
  abstract GetSymbol: unknown;
  abstract GetNamespacedFree: unknown;
  abstract GetStrictFree: unknown;
  abstract GetLooseAttr: unknown;
  abstract GetLooseAppend: unknown;
  abstract GetPath: unknown;
  abstract Invoke: unknown;
  abstract positionalArguments: unknown;
  abstract namedArguments: unknown;
  abstract args: unknown;
}

export abstract class UnpackExpr<O extends ExprOutput> {
  abstract hasBlock(symbol: number | undefined): O['HasBlock'];
  abstract hasBlockParams(symbol: number | undefined): O['HasBlockParams'];
  abstract literal(value: null | undefined | boolean | string | number): O['Literal'];
  abstract getThis(): O['GetThis'];
  abstract getSymbol(value: number): O['GetSymbol'];
  abstract getNamespacedFree(upvar: number, namespace: VariableNamespace): O['GetNamespacedFree'];
  abstract getStrictFree(upvar: number): O['GetStrictFree'];
  abstract getLooseAttr(upvar: number): O['GetLooseAttr'];
  abstract getLooseAppend(upvar: number): O['GetLooseAppend'];
  abstract getPath(head: O['expr'], tail: PresentArray<string>): O['GetPath'];
  abstract invoke(callee: O['expr'], args: O['args']): O['Invoke'];
  abstract positional(positional: null | PresentArray<O['expr']>): O['positionalArguments'];
  abstract namedArguments(positional: null | [string, O['expr']][]): O['namedArguments'];
  abstract args(
    positional: null | O['positionalArguments'],
    named: null | O['namedArguments']
  ): O['args'];
}

export type ExprOutputFor<U extends UnpackExpr<ExprOutput>> = U extends UnpackExpr<infer O>
  ? O
  : never;

const NONE = Object.freeze({ none: true });
type NONE = typeof NONE;

export class ExprDecoder<O extends ExprOutput> {
  constructor(readonly decoder: UnpackExpr<O>) {}

  expr(e: Expression): O['expr'] {
    if (e === ExprOp.GetThis) {
      return this.decoder.getThis();
    }

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
        let [, head, tail, ...rest] = e;
        return this.decoder.getPath(this.expr(head), [tail, ...rest]);
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
    let [, callee, positional, named] = e;
    return this.decoder.invoke(this.expr(callee), this.args(positional, named));
  }

  private positional(p: PositionalArguments | undefined): O['positionalArguments'] {
    if (p === Null || p === undefined) {
      return this.decoder.positional(null);
    } else {
      return this.decoder.positional(mapPresent(p, (e) => this.expr(e)));
    }
  }

  namedArguments(p: NamedArguments | undefined): O['namedArguments'] {
    if (p === Null || p === undefined) {
      return null;
    }

    let o: [string, O['expr']][] = [];
    let names = p[0].split('|');

    names.forEach((n, i) => o.push([n, this.expr(p[i + 1])]));

    return this.decoder.namedArguments(o);
  }

  args(p: PositionalArguments | undefined, n: NamedArguments | undefined): O['args'] {
    return this.decoder.args(this.positional(p), this.namedArguments(n));
  }
}

function isLonghand(e: Expression): e is LonghandExpression {
  return Array.isArray(e);
}
