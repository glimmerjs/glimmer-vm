import type { SourceSlice } from '../source/slice';
import type { SourceSpan } from '../source/span';
import type { HasSourceSpan } from '../source/span-list';
import type { AnyNode, ArgsParentValidationContext } from './validation-context';

import { loc } from '../source/span-list';
import { ValueValidationContext } from './validation-context';

/**
 * An args container has `positional` and `named` properties.
 */

export interface ArgsContainerContext {
  positionalArgs(positionals: AnyNode): PositionalArgsContext;
  namedArg(arg: NamedArgContainer): ValueValidationContext;
}

export class ArgsContext implements ArgsContainerContext {
  readonly context: SourceSpan;
  #parent: ArgsParentValidationContext;
  #positional: SourceSpan;
  #named: SourceSpan;

  constructor(parent: ArgsParentValidationContext, positional: SourceSpan, named: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
    this.#positional = positional;
    this.#named = named;
  }

  positionalArgs(): PositionalArgsContext {
    return new PositionalArgsContext(this.#parent, this.#positional);
  }

  namedContainer(container: NamedArgContainer) {
    return new NamedArgContext(this.#parent, container);
  }

  namedArg(arg: NamedArgContainer & { value: AnyNode }): ValueValidationContext {
    return this.namedArg(arg);
  }
}

export class PositionalArgsContext {
  readonly context: SourceSpan;
  #parent: ArgsParentValidationContext;
  #span: SourceSpan;

  constructor(parent: ArgsParentValidationContext, span: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
    this.#span = span;
  }

  value(value: HasSourceSpan) {
    return ValueValidationContext.positional(this.#parent, loc(value));
  }
}

export class NamedArgContext {
  readonly context: SourceSpan;
  #parent: ArgsParentValidationContext;
  #container: NamedArgContainer;

  constructor(parent: ArgsParentValidationContext, container: NamedArgContainer) {
    this.context = parent.context;
    this.#parent = parent;
    this.#container = container;
  }

  value(arg: HasSourceSpan) {
    return ValueValidationContext.named(this.#parent, loc(arg), this.#container);
  }
}

export interface NamedArgContainer {
  key: SourceSlice;
  loc: SourceSpan;
  value: AnyNode;
}

export type SomeArgsContext = ArgsContext | PositionalArgsContext | NamedArgContext;
