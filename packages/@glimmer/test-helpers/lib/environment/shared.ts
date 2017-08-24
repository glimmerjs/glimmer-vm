import { precompile } from '@glimmer/compiler';
import { Dict, Opaque, Option } from '@glimmer/interfaces';
import { ComponentCapabilities, ParsedLayout } from '@glimmer/opcode-compiler';
import { ComponentManager } from '@glimmer/runtime';
import { SerializedTemplateBlock, SerializedTemplateWithLazyBlock, TemplateMeta } from '@glimmer/wire-format';

export type Attrs = Dict<any>;
export interface AttrsDiff { oldAttrs: Option<Attrs>, newAttrs: Attrs }

export interface Definition {
  capabilities: ComponentCapabilities;
}

export abstract class GenericComponentDefinition<T> implements Definition {
  abstract capabilities: ComponentCapabilities;

  constructor(public name: string, public manager: ComponentManager<T, GenericComponentDefinition<T>>, public ComponentClass: any, public layout: Option<number>) {
  }

  toJSON() {
    return { GlimmerDebug: `<component ${this.name}>` };
  }
}

export class GenericComponentManager {
  getCapabilities(definition: GenericComponentDefinition<Opaque>): ComponentCapabilities {
    return definition.capabilities;
  }
}

export function createTemplate(templateSource: string, meta: TemplateMeta = {}): ParsedLayout {
  let wrapper: SerializedTemplateWithLazyBlock<TemplateMeta> = JSON.parse(precompile(templateSource, { meta }));
  let block: SerializedTemplateBlock = JSON.parse(wrapper.block);

  return { block, referer: meta };
}
