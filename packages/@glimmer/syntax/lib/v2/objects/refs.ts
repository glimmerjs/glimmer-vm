import type { SourceSlice } from '../../source/slice';
import type { AbstractNode } from './node';

import { node } from './node';

export type ReferenceType = 'dynamic' | 'resolved' | 'lexical';

/**
 * Corresponds to `this` at the head of an expression.
 */
export class ThisReference extends node('This').fields() {}

/**
 * Corresponds to `@<ident>` at the beginning of an expression.
 */
export class ArgReference extends node('Arg').fields<{ name: SourceSlice; symbol: number }>() {}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
 * block's scope.
 */
export class LocalVarReference extends node('Local').fields<{
  name: string;
  referenceType: 'dynamic' | 'lexical';
  symbol: number;
}>() {}

export class ResolvedHelperCallee extends node('ResolvedHelperCallee').fields<{
  name: string;
  symbol: number;
}>() {}

export class ResolvedModifierCallee extends node('ResolvedModifierCallee').fields<{
  name: string;
  symbol: number;
}>() {}

export class ResolvedComponentCallee extends node('ResolvedComponentCallee').fields<{
  name: string;
  symbol: number;
}>() {}

export class ResolvedAppendable extends node('ResolvedAppendable').fields<{
  name: string;
  symbol: number;
}>() {}

export type VariableReference = ThisReference | ArgReference | LocalVarReference;

export function isVariableReference(node: AbstractNode): node is VariableReference {
  return (
    node.type === 'This' || node.type === 'Arg' || node.type === 'Local' || node.type === 'Resolved'
  );
}
