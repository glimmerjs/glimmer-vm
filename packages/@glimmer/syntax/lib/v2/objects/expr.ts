import { PresentArray } from '@glimmer/interfaces';
import { VariableReference } from '../nodes-v2';
import { Args } from './args';
import { BaseNode, BaseNodeOptions, CallNode, CallNodeOptions } from './base';
import { SourceSlice } from './internal';

export abstract class BaseExpressionNode extends BaseNode {
  isLiteral<K extends keyof LiteralTypes>(_kind?: K): this is LiteralExpression<LiteralTypes[K]> {
    return false;
  }
}

export type LiteralValue = string | boolean | number | undefined | null;

export interface LiteralTypes {
  string: string;
  boolean: boolean;
  number: number;
  null: null;
  undefined: undefined;
}

export class LiteralExpression<V extends LiteralValue = LiteralValue> extends BaseExpressionNode {
  readonly type = 'LiteralExpression';
  readonly value: V;

  constructor(options: BaseNodeOptions & { value: V }) {
    super(options);
    this.value = options.value;
  }

  isLiteral<K extends keyof LiteralTypes>(kind?: K): this is LiteralExpression<LiteralTypes[K]> {
    if (kind === undefined) {
      return true;
    }

    if (kind === 'null') {
      return this.value === null;
    }

    return typeof this.value === kind;
  }
}

export class PathExpression extends BaseExpressionNode {
  readonly type = 'PathExpression';
  readonly ref: VariableReference;
  readonly tail: SourceSlice[];

  constructor(options: BaseNodeOptions & { ref: VariableReference; tail: SourceSlice[] }) {
    super(options);
    this.ref = options.ref;
    this.tail = options.tail;
  }
}

export class CallExpression extends BaseExpressionNode implements CallNode {
  readonly type = 'CallExpression';
  readonly callee: Expression;
  readonly args: Args;

  constructor(options: CallNodeOptions) {
    super(options);
    this.callee = options.callee;
    this.args = options.args;
  }
}

export class InterpolateExpression extends BaseExpressionNode {
  readonly type = 'Interpolate';
  readonly parts: PresentArray<Expression>;

  constructor(options: BaseNodeOptions & { parts: PresentArray<Expression> }) {
    super(options);
    this.parts = options.parts;
  }
}

export type Expression =
  | LiteralExpression
  | PathExpression
  | CallExpression
  | InterpolateExpression;
