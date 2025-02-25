import type { SourceSpan } from '../source/span';
import type { HasSourceSpan } from '../source/span-list';
import type {
  AnyInvokeParentContext,
  AnyNode,
  AnyValidationContext,
  ArgsNode,
  InvokeKind,
  InvokeParentContext,
  NameNode,
  VariableReferenceValidationContext,
} from './validation-context';

import { loc } from '../source/span-list';
import { ArgsContext } from './args';
import { FullElementParameterValidationContext, InvokeElementParameterContext } from './element';
import {
  isResolvedName,
  PathValidationContext,
  ValueValidationContext,
} from './validation-context';

/**
 * Represents the context for tag names, attributes, arguments and modifiers that live inside of an
 * angle bracket expression.
 *
 * - Angle Bracket Component Syntax
 * - Simple Element Syntax (supports dynamic attributes, modifiers and splattributes)
 */
export class AngleBracketContext implements AnyValidationContext {
  static component(this: void, span: AnyNode): AngleBracketContext {
    return new AngleBracketContext(loc(span), 'component');
  }

  static element(this: void, span: AnyNode): AngleBracketContext {
    return new AngleBracketContext(loc(span), 'element');
  }

  readonly context: SourceSpan;
  readonly type: 'component' | 'element';
  readonly syntax = 'angle-bracket';
  #span: SourceSpan;

  private constructor(span: SourceSpan, type: 'component' | 'element') {
    debugger;
    this.context = span;
    this.type = type;
    this.#span = span;
  }

  describe() {
    switch (this.type) {
      case 'component':
        return 'a component invocation';
      case 'element':
        return 'an element';
    }
  }

  tag<N extends AnyNode>(name: N): PathValidationContext {
    return new PathValidationContext(this, loc(name), (path) => ({
      attempted: `invoke \`${path}\` as a component`,
      describe: 'component name',
    }));
  }

  attr(attr: HasSourceSpan) {
    return new FullElementParameterValidationContext(this, loc(attr), 'attr');
  }

  arg(arg: HasSourceSpan) {
    return new FullElementParameterValidationContext(this, loc(arg), 'arg');
  }

  modifier(modifier: HasSourceSpan) {
    return new InvokeElementParameterContext(this, loc(modifier), 'modifier');
  }
}

export class InvokeBlockValidationContext implements AnyInvokeParentContext {
  static of(this: void, span: AnyNode) {
    return new InvokeBlockValidationContext(loc(span));
  }

  readonly type = 'block';
  readonly context: SourceSpan;
  #block: SourceSpan;

  constructor(span: SourceSpan) {
    this.context = span;
    this.#block = span;
  }

  callee(callee: NameNode): VariableReferenceValidationContext;
  callee(callee: AnyNode): ValueValidationContext;
  callee(callee: AnyNode) {
    return getCalleeContext('block', this, callee);
  }

  args(args: ArgsNode) {
    return new ArgsContext(this, loc(args.positional), loc(args.named));
  }
}

export type SomeContentValidationContext = AngleBracketContext | InvokeBlockValidationContext;

export function getCalleeContext(kind: InvokeKind, context: InvokeParentContext, callee: AnyNode) {
  if (isResolvedName(callee)) {
    return ValueValidationContext.callee(kind, context, loc(callee)).resolved(callee);
  }
  return ValueValidationContext.callee(kind, context, loc(callee));
}
