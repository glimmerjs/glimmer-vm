import { SourceLocation } from '../../types/api';
import { Args } from './args';
import { ContentNode } from './content';
import { Expression } from './expr';

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

export abstract class GlimmerParentNode extends BaseNode {
  readonly body: readonly ContentNode[];

  constructor(options: GlimmerParentNodeOptions) {
    super(options);
    this.body = options.body;
  }
}

export interface CallNodeOptions extends BaseNodeOptions {
  callee: Expression;
  args: Args;
}

export abstract class CallNode extends BaseNode {
  readonly callee: Expression;
  readonly args: Args;

  constructor(options: CallNodeOptions) {
    super(options);
    this.callee = options.callee;
    this.args = options.args;
  }
}
