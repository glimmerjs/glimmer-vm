import { TemplateMeta } from '@glimmer/wire-format';
import { CompiledDynamicProgram } from './compiled/blocks';
import { Template } from './template';

export class PartialDefinition<T extends TemplateMeta = TemplateMeta> {
  constructor(
    public name: string, // for debugging
    public template: Template<T>
  ) {
  }

  getPartial(): CompiledDynamicProgram {
    return this.template.asPartial().compileDynamic();
  }
}
