import { Opaque } from '@glimmer/interfaces';
import { isConst, Reference, VersionedPathReference, Tag, VersionedReference } from '@glimmer/reference';
import { Op } from '@glimmer/vm';
import { DynamicContentWrapper } from '../../vm/content/dynamic';
import { isComponentDefinition } from '../../component/interfaces';
import { UpdatingOpcode } from '../../opcodes';
import { ConditionalReference } from '../../references';
import { UpdatingVM, VM } from '../../vm';
import { Opcode } from '../../environment';

export const CONTENT_MAPPINGS = {};

export class IsComponentDefinitionReference extends ConditionalReference {
  static create(inner: Reference<Opaque>): IsComponentDefinitionReference {
    return new IsComponentDefinitionReference(inner);
  }

  toBool(value: Opaque): boolean {
    return isComponentDefinition(value);
  }
}

export function DynamicContent(vm: VM, { op1: isTrusting }: Opcode) {
  let reference = vm.stack.pop<VersionedPathReference<Opaque>>();
  let value = reference.value();
  let content: DynamicContentWrapper;

  if (isTrusting) {
    content = vm.elements().appendTrustingDynamicContent(value);
  } else {
    content = vm.elements().appendCautiousDynamicContent(value);
  }

  if (!isConst(reference)) {
    vm.updateWith(new UpdateDynamicContentOpcode(reference, content));
  }
}

CONTENT_MAPPINGS[Op.DynamicContent] = DynamicContent;

class UpdateDynamicContentOpcode extends UpdatingOpcode {
  public tag: Tag;

  constructor(private reference: VersionedReference<Opaque>, private content: DynamicContentWrapper) {
    super();
    this.tag = reference.tag;
  }

  evaluate(vm: UpdatingVM): void {
    let { content, reference } = this;
    content.update(vm.env, reference.value());
  }
}
