import { TemplateMeta } from '@glimmer/wire-format';
import { CompiledDynamicTopLevel } from './compiled/blocks';
import { Template } from './template';

export class PartialDefinition<T extends TemplateMeta = TemplateMeta> {
  constructor(
    public name: string, // for debugging
    public template: Template<T>
  ) {
  }

  getPartial(): CompiledDynamicTopLevel {
    return this.template.asPartial().compileDynamic();
  }
}
