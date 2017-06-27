import { TemplateMeta } from '@glimmer/wire-format';
import { Opaque, Option, Unique } from './core';

export type Specifier = Unique<"Specifier">;

export interface Resolver<S = Specifier, T extends TemplateMeta = TemplateMeta> {
  lookupHelper(name: string, meta: T): Option<S>;
  lookupModifier(name: string, meta: T): Option<S>;
  lookupComponent(name: string, meta: T): Option<S>;
  lookupPartial(name: string, meta: T): Option<S>;

  resolve<U>(specifier: S): U;
}
