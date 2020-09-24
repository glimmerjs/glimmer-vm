import { PresentArray } from '@glimmer/interfaces';

import { SourceSlice } from '../../-internal';
import { CallFields, node, VariableReference } from './-internal';

export type LiteralValue = string | boolean | number | undefined | null;

export interface LiteralTypes {
  string: string;
  boolean: boolean;
  number: number;
  null: null;
  undefined: undefined;
}

export class LiteralExpression extends node('Literal').fields<{ value: LiteralValue }>() {
  toSlice(this: StringLiteral): SourceSlice {
    return new SourceSlice({ loc: this.loc, chars: this.value });
  }
}

export type StringLiteral = LiteralExpression & { value: string };

export function isLiteral<K extends keyof LiteralTypes = keyof LiteralTypes>(
  node: ExpressionNode,
  kind?: K
): node is StringLiteral {
  if (node.type === 'Literal') {
    if (kind === undefined) {
      return true;
    } else if (kind === 'null') {
      return node.value === null;
    } else {
      return typeof node.value === kind;
    }
  } else {
    return false;
  }
}

export class PathExpression extends node('Path').fields<{
  ref: VariableReference;
  tail: readonly SourceSlice[];
}>() {}

export class CallExpression extends node('Call').fields<CallFields>() {}

export class InterpolateExpression extends node('Interpolate').fields<{
  parts: PresentArray<ExpressionNode>;
}>() {}

export type ExpressionNode =
  | LiteralExpression
  | PathExpression
  | CallExpression
  | InterpolateExpression;
