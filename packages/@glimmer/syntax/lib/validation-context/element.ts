import type { SourceSpan } from '../source/span';
import type { HasSourceSpan } from '../source/span-list';
import type { AngleBracketContext } from './content';
import type {
  AnyAttrLikeContainerContext,
  AnyInvokeParentContext,
  AnyNode,
  AnyValidationContext,
  ArgsNode,
  InvokeSyntaxType,
  NameNode,
  ResolvedNode,
  VariableReferenceContext,
} from './validation-context';

import { loc } from '../source/span-list';
import { ArgsContext } from './args';
import { ValueValidationContext } from './validation-context';

/**
 * The context for `attr={{...}}` and `@arg={{...}}`.
 *
 * It's a "full" element parameter context because it tracks the full span, including `attr=` and
 * `@arg=`.
 */
export class FullElementParameterValidationContext
  implements AnyValidationContext, AnyAttrLikeContainerContext
{
  #parent: AngleBracketContext;
  readonly context: SourceSpan;
  readonly type: 'attr' | 'arg';

  constructor(parent: AngleBracketContext, _container: SourceSpan, type: 'attr' | 'arg') {
    this.context = parent.context;
    this.#parent = parent;
    this.type = type;
  }

  describe(depth: 'shallow' | 'full' = 'shallow') {
    switch (this.type) {
      case 'attr':
        return depth === 'shallow' ? 'an attribute' : `an attribute in ${this.#parent.describe()}`;
      case 'arg':
        return 'an argument';
    }
  }

  resolved(node: ResolvedNode) {
    return this.value({ value: node, curly: node }).resolved(node.resolved);
  }

  concat(concat: HasSourceSpan): ConcatContext {
    return new ConcatContext(this, loc(concat));
  }

  value({ value, curly }: { value: HasSourceSpan; curly: HasSourceSpan }): ValueValidationContext {
    return ValueValidationContext.parameter(this, loc(value), { curly: loc(curly), callee: false });
  }

  invoke(curly: HasSourceSpan) {
    return new InvokeElementParameterContext(this, loc(curly), this.type);
  }

  callee(node: ResolvedNode): VariableReferenceContext {
    return ValueValidationContext.parameter(this, loc(node.resolved), {
      curly: loc(node),
      callee: true,
    }).resolved(node.resolved);
  }
}

/**
 * Represents the parent of interpolation syntax:
 *
 * - `attr="{{...}}..."`
 * - `@arg="{{...}}..."`
 */

export class ConcatContext implements AnyValidationContext, AnyAttrLikeContainerContext {
  readonly context: SourceSpan;
  readonly type = 'concat';
  #parent: FullElementParameterValidationContext;

  constructor(parent: FullElementParameterValidationContext, _span: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
  }

  describe(depth: 'shallow' | 'context' | 'full' = 'shallow') {
    if (depth === 'shallow') {
      return 'an interpolated string';
    } else if (depth === 'context') {
      return `an interpolated string in ${this.#parent.describe()}`;
    } else {
      return ``;
    }
  }

  value({ value, curly }: { value: HasSourceSpan; curly: HasSourceSpan }): ValueValidationContext {
    return ValueValidationContext.concat(this, loc(value), { curly: loc(curly) });
  }

  invoke(curly: HasSourceSpan) {
    return new InvokeElementParameterContext(this, loc(curly), this.#parent.type);
  }

  resolved(node: ResolvedNode): VariableReferenceContext {
    return ValueValidationContext.concat(this, loc(node.resolved), {
      curly: loc(node),
    }).resolved(node.resolved);
  }
}

/**
 * These represent `{{}}`s that live inside of an element or component tag:
 *
 * - attribute values
 * - argument values
 * - modifiers
 * - concatenated curlies ({@linkcode ConcatContext})
 */
export class InvokeElementParameterContext implements AnyInvokeParentContext {
  readonly context: SourceSpan;
  readonly what: 'attr' | 'arg' | 'modifier';
  readonly type: InvokeSyntaxType;

  constructor(parent: AngleBracketContext, curly: SourceSpan, type: 'modifier');
  constructor(
    parent: FullElementParameterValidationContext | ConcatContext,
    curly: SourceSpan,
    type: 'attr' | 'arg'
  );
  constructor(
    parent: FullElementParameterValidationContext | AngleBracketContext | ConcatContext,
    _curly: SourceSpan,
    type: 'attr' | 'arg' | 'modifier'
  ) {
    this.context = parent.context;
    this.what = type;
    this.type = type === 'modifier' ? 'modifier' : { type, kind: 'invoke' };
  }

  describe() {
    switch (this.what) {
      case 'modifier':
        return 'an element modifier';
      case 'attr':
        return 'an attribute';
      case 'arg':
        return 'an argument to a component';
    }
  }

  callee(callee: AnyNode): ValueValidationContext {
    return ValueValidationContext.callee(this.what, this, loc(callee));
  }

  resolved(callee: NameNode): VariableReferenceContext {
    return this.callee(callee).resolved(callee);
  }

  args(args: ArgsNode) {
    return new ArgsContext(this, loc(args.positional), loc(args.named));
  }
}

export type SomeElementValidationContext =
  | FullElementParameterValidationContext
  | InvokeElementParameterContext
  | ConcatContext
  | AngleBracketContext;
