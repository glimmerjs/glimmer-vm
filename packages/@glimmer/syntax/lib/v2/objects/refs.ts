import type { SourceSlice } from '../../source/slice';
import { AstNode } from './node';
import type { FreeVarResolution as FreeVariableResolution } from './resolution';

/**
 * Corresponds to `this` at the head of an expression.
 */
export class ThisReference extends AstNode {
  readonly type = 'This';
}

/**
 * Corresponds to `@<ident>` at the beginning of an expression.
 */
export class ArgReference extends AstNode {
  readonly type = 'Arg';
  declare name: SourceSlice;
  declare symbol: number;
}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
 * block's scope.
 */
export class LocalVarReference extends AstNode {
  readonly type = 'Local';
  declare name: string;
  declare isTemplateLocal: boolean;
  declare symbol: number;
}

/**
 * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is *not* in the
 * current block's scope.
 *
 * The `resolution: FreeVarResolution` field describes how to resolve the free variable.
 *
 * Note: In strict mode, it must always be a variable that is in a concrete JavaScript scope that
 * the template will be installed into.
 */
export class FreeVarReference extends AstNode {
  readonly type = 'Free';
  declare name: string;
  declare resolution: FreeVariableResolution;
  declare symbol: number;
}

export class KeywordReference extends AstNode {
  readonly type = 'keyword';
  declare name: string;
}

export type VariableReference = ThisReference | ArgReference | LocalVarReference | FreeVarReference;
