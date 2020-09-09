import { ResolvedLayout, Optional } from '@glimmer/interfaces';
import { MacroContext } from './syntax/macros';
import { MINIMAL_CAPABILITIES } from './opcode-builder/delegate';

export function resolveLayoutForTag(
  tag: string,
  { resolver, meta: { referrer } }: MacroContext
): Optional<ResolvedLayout> {
  let component = resolver.lookupComponent(tag, referrer);
  if (component === null) return component;
  let { handle, compilable, capabilities } = component;

  return {
    handle,
    compilable,
    capabilities: capabilities || MINIMAL_CAPABILITIES,
  };
}
