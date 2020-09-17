import { SourceLocation } from '../../types/api';
import { Args } from './args';
import { ContentNode } from './content';
import { ExpressionNode } from './expr';

export interface BaseNodeOptions {
  loc: SourceLocation;
}

export abstract class BaseNode {
  abstract readonly type: string;
  readonly loc: SourceLocation;

  constructor({ loc }: BaseNodeOptions) {
    this.loc = loc;
  }
}

export interface GlimmerParentNodeOptions extends BaseNodeOptions {
  body: readonly ContentNode[];
}

export abstract class BaseGlimmerParent extends BaseNode {
  readonly body: readonly ContentNode[];

  constructor(options: GlimmerParentNodeOptions) {
    super(options);
    this.body = options.body;
  }
}

export interface CallOptions extends BaseNodeOptions {
  callee: ExpressionNode;
  args: Args;
}

export abstract class BaseCall extends BaseNode {
  readonly callee: ExpressionNode;
  readonly args: Args;

  constructor(options: CallOptions) {
    super(options);
    this.callee = options.callee;
    this.args = options.args;
  }
}
