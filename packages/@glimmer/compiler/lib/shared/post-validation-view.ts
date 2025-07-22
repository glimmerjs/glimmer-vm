import type { ASTv1, ASTv2 } from '@glimmer/syntax';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

/**
 * PostValidationView provides type-safe access to AST nodes after validation has occurred.
 * At this stage in the compiler pipeline:
 * 1. All ErrorNodes should have been caught and reported
 * 2. All UnresolvedBindings should have been resolved
 *
 * This view enforces these guarantees through runtime assertions in development mode.
 */
export class PostValidationView {
  constructor(private phase: string) {}

  /**
   * Primary method that asserts the value is not an ErrorNode or UnresolvedBinding.
   * This unifies all validation logic in one place.
   */
  get<T extends { type: string }>(
    value: T | ASTv2.UnresolvedBinding | ASTv1.ErrorNode,
    context = 'value'
  ): T {
    if (LOCAL_DEBUG) {
      // Check for ErrorNode
      if (value.type === 'Error') {
        throw new Error(
          `ErrorNode found in ${context} during ${this.phase} phase. All errors should have been caught during validation.`
        );
      }

      // Check for UnresolvedBinding
      if (value.type === 'UnresolvedBinding') {
        throw new Error(
          `UnresolvedBinding '${
            (value as ASTv2.UnresolvedBinding).name
          }' found in ${context} during ${this.phase} phase. All bindings should have been resolved during validation.`
        );
      }
    }

    return value as T;
  }
}

/**
 * Create a PostValidationView for the normalization phase
 */
export function createNormalizationView(): PostValidationView {
  return new PostValidationView('normalization');
}

/**
 * Create a PostValidationView for the encoding phase
 */
export function createEncodingView(): PostValidationView {
  return new PostValidationView('encoding');
}
