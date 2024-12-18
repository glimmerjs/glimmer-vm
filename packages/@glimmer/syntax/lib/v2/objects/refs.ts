import type { SourceSlice } from '../../source/slice';
import type { NodeConstructor } from './node';
import type { FreeVarResolution } from './resolution';

import { AstNode } from './node';

/**
 * Corresponds to `this` at the head of an expression.
 */
export const ThisReferenceFields: NodeConstructor<'This'> = AstNode('This');
export class ThisReference extends ThisReferenceFields {}

/**
 * Corresponds to `@<ident>` at the beginning of an expression.
 */
export const ArgReferenceFields: NodeConstructor<'Arg', { name: SourceSlice; symbol: number }> =
  AstNode('Arg');
export class ArgReference extends ArgReferenceFields {}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
 * block's scope.
 */
export const LocalVarReferenceFields: NodeConstructor<
  'Local',
  { name: string; isTemplateLocal: boolean; symbol: number }
> = AstNode('Local');
export class LocalVarReference extends LocalVarReferenceFields {}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is *not* in the
 * current block's scope.
 *
 * The `resolution: FreeVarResolution` field describes how to resolve the free variable.
 *
 * Note: In strict mode, it must always be a variable that is in a concrete JavaScript scope that
 * the template will be installed into.
 */
export const FreeVarReferenceFields: NodeConstructor<
  'Free',
  { name: string; resolution: FreeVarResolution; symbol: number }
> = AstNode('Free');
export class FreeVarReference extends FreeVarReferenceFields {}

export type VariableReference = ThisReference | ArgReference | LocalVarReference | FreeVarReference;
