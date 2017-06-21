import { TemplateMeta } from '@glimmer/wire-format';
import { Opaque, Option, Unique } from './core';

export type Specifier = Unique<"Specifier">;

export interface Resolver<S = Specifier, T extends TemplateMeta = TemplateMeta> {
  lookupHelper(templateName: string, templateMeta: T): Option<S>;
  lookupModifier(templateName: string, templateMeta: T): Option<S>;
  lookupComponent(templateName: string, templateMeta: T): Option<S>;
  lookupPartial(templateName: string, templateMeta: T): Option<S>;

  resolve<U>(specifier: S): U;
}
