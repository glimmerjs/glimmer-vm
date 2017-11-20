import { VM, RenderResult, IteratorResult } from './vm';
import { Opaque } from "@glimmer/util";

export class TemplateIterator {
  constructor(private vm: VM<Opaque>) {}
  next(): IteratorResult<RenderResult> {
    return this.vm.next();
  }
}
