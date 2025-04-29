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
  symbol: number;
}>() {}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
 * block's scope.
 */
export class LexicalVarReference extends node('Lexical').fields<{
  name: string;
  symbol: number;
}>() {}

/**
 * Variable references are references to in-scope variables, and they are never candidates for
 * resolution.
 */
export type VariableReference =
  | ThisReference
  | ArgReference
  | LocalVarReference
  | LexicalVarReference;

export function isVariableReference(node: AbstractNode): node is VariableReference {
  return (
    node.type === 'This' || node.type === 'Arg' || node.type === 'Local' || node.type === 'Resolved'
  );
}
