import type { CompilableTemplate, IS_COMPILABLE_TEMPLATE_BRAND } from '@glimmer/interfaces';

export const IS_COMPILABLE_TEMPLATE: IS_COMPILABLE_TEMPLATE_BRAND = Symbol(
  'IS_COMPILABLE_TEMPLATE'
) as IS_COMPILABLE_TEMPLATE_BRAND;

export type IS_COMPILABLE_TEMPLATE = IS_COMPILABLE_TEMPLATE_BRAND;

export function isCompilable(value: unknown): value is CompilableTemplate {
  return !!(value && typeof value === 'object' && IS_COMPILABLE_TEMPLATE in value);
}
