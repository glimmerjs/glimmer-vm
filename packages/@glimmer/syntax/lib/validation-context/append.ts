import type { SourceSpan } from '../source/span';
import type {
  AnyInvokeParentContext,
  AnyNode,
  ArgsNode,
  CallNode,
  NameNode,
  ResolvedNode,
  VariableReferenceContext,
} from './validation-context';

import { loc } from '../source/span-list';
import { ArgsContext } from './args';
import { isResolvedName, SubExpressionContext, ValueValidationContext } from './validation-context';

export class AppendInvokeContext implements AnyInvokeParentContext {
  static of(node: AnyNode) {
    return new AppendInvokeContext(loc(node));
  }

  readonly type = { type: 'append', kind: 'invoke' } as const;
  readonly context: SourceSpan;
  readonly isInvoke = true;

  constructor(span: SourceSpan) {
    this.context = span;
  }

  callee(callee: AnyNode) {
    return ValueValidationContext.callee('append', this, loc(callee));
  }

  resolved(callee: NameNode) {
    return this.callee(callee).resolved(callee);
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
    return new SubExpressionContext(this, loc(value));
  }

  resolved(value: NameNode) {
    return ValueValidationContext.append(this, loc(value)).resolved(value);
  }

  append<T extends AnyNode>(
    value: T
  ): T extends NameNode
    ? ValueValidationContext | VariableReferenceContext
    : ValueValidationContext;
  append(value: AnyNode | ResolvedNode): ValueValidationContext | VariableReferenceContext {
    const valueContext = ValueValidationContext.append(this, loc(value));
    return isResolvedName(value) ? valueContext.resolved(value) : valueContext;
  }
}

export type SomeAppendContext = AppendInvokeContext | AppendValueContext;
