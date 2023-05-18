import type { CompileTimeComponent, Nullable } from '@glimmer/interfaces';

export interface ResolverDelegate<R = unknown> {
  lookupHelper?(name: string, referrer: R): Nullable<number> | void;
  lookupModifier?(name: string, referrer: R): Nullable<number> | void;
  lookupComponent?(name: string, referrer: R): Nullable<CompileTimeComponent> | void;

  // For debugging
  resolve?(handle: number): R;
}
