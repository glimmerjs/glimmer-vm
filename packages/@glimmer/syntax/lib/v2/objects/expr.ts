import { PresentArray } from '@glimmer/interfaces';
import { VariableReference } from '../nodes-v2';
import { Args } from './args';
import { BaseNode, BaseNodeOptions, BaseCall, CallOptions } from './base';
import { SourceSlice } from './internal';

export abstract class BaseExpression extends BaseNode {
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

export class LiteralExpression<V extends LiteralValue = LiteralValue> extends BaseExpression {
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

export class PathExpression extends BaseExpression {
  readonly type = 'PathExpression';
  readonly ref: VariableReference;
  readonly tail: SourceSlice[];

  constructor(options: BaseNodeOptions & { ref: VariableReference; tail: SourceSlice[] }) {
    super(options);
    this.ref = options.ref;
    this.tail = options.tail;
  }
}

export class CallExpression extends BaseExpression implements BaseCall {
  readonly type = 'CallExpression';
  readonly callee: ExpressionNode;
  readonly args: Args;

  constructor(options: CallOptions) {
    super(options);
    this.callee = options.callee;
    this.args = options.args;
  }
}

export class InterpolateExpression extends BaseExpression {
  readonly type = 'Interpolate';
  readonly parts: PresentArray<ExpressionNode>;

  constructor(options: BaseNodeOptions & { parts: PresentArray<ExpressionNode> }) {
    super(options);
    this.parts = options.parts;
  }
}

export type ExpressionNode =
  | LiteralExpression
  | PathExpression
  | CallExpression
  | InterpolateExpression;
