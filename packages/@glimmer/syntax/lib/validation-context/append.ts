import type { SourceSpan } from '../source/span';
import type {
  AnyInvokeParentContext,
  AnyNode,
  ArgsNode,
  CallNode,
  NameNode,
  VariableReferenceValidationContext,
} from './validation-context';

import { loc } from '../source/span-list';
import { ArgsContext } from './args';
import { getCalleeContext } from './content';
import { SubExpressionValidationContext, ValueValidationContext } from './validation-context';

export class AppendInvokeContext implements AnyInvokeParentContext {
  static of(node: AnyNode) {
    return new AppendInvokeContext(loc(node));
  }

  readonly type = { type: 'append', kind: 'invoke' } as const;
  readonly context: SourceSpan;
  readonly isInvoke = true;
  #append: SourceSpan;

  constructor(span: SourceSpan) {
    this.context = span;
    this.#append = span;
  }

  callee(callee: NameNode): VariableReferenceValidationContext;
  callee(callee: AnyNode): ValueValidationContext;
  callee(callee: AnyNode) {
    return getCalleeContext('append', this, callee);
  }

  args(args: ArgsNode) {
    return new ArgsContext(this, loc(args.positional), loc(args.named));
  }
}

export class AppendValueContext {
  static of(this: void, node: AnyNode) {
    return new AppendValueContext(loc(node));
  }

  readonly context: SourceSpan;
  #append: SourceSpan;

  constructor(span: SourceSpan) {
    this.context = span;
    this.#append = span;
  }

  invoke() {
    return new AppendInvokeContext(this.#append);
  }

  subexpression(value: CallNode) {
    return new SubExpressionValidationContext(this, loc(value));
  }

  append(value: AnyNode) {
    return ValueValidationContext.append(this, loc(value));
  }
}

export type SomeAppendContext = AppendInvokeContext | AppendValueContext;
