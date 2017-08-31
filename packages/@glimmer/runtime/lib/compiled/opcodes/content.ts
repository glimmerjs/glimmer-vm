import { isCurriedComponentDefinition } from '../../component/interfaces';
import { Opaque, Reifiable, NodeTokens } from '@glimmer/interfaces';
import { isConst, Reference, VersionedPathReference, Tag, VersionedReference } from '@glimmer/reference';
import { Op } from '@glimmer/vm';
import { DynamicContentWrapper, DynamicContent } from '../../vm/content/dynamic';
import { APPEND_OPCODES, UpdatingOpcode } from '../../opcodes';
import { ConditionalReference } from '../../references';
import { UpdatingVM } from '../../vm';
import { appendCautiousDynamicContent } from '../../vm/content/dynamic-content-helpers';

export class IsCurriedComponentDefinitionReference extends ConditionalReference {
  static create(inner: Reference<Opaque>): IsCurriedComponentDefinitionReference {
    return new IsCurriedComponentDefinitionReference(inner);
  }

  toBool(value: Opaque): boolean {
    return isCurriedComponentDefinition(value);
  }
}

APPEND_OPCODES.add(Op.DynamicContent, (vm, { op1: isTrusting }) => {
  let reference = vm.stack.pop<VersionedPathReference<Opaque>>();
  let value = reference.value();
  let content: DynamicContent;

  if (isTrusting) {
    content = vm.elements().appendTrustingDynamicContent(value);
  } else {
    content = appendCautiousDynamicContent(value, vm.elements().parent!, vm.elements().tree);
  }

  let wrapper = new DynamicContentWrapper(content);

  if (!isConst(reference)) {
    vm.updateWith(new UpdateDynamicContentOpcode(reference, wrapper), true);
  }
});

class UpdateDynamicContentOpcode extends UpdatingOpcode implements Reifiable {
  public tag: Tag;

  constructor(private reference: VersionedReference<Opaque>, private content: DynamicContentWrapper) {
    super();
    this.tag = reference.tag;
  }

  evaluate(vm: UpdatingVM): void {
    let { content, reference } = this;
    content.update(vm.env, reference.value());
  }

  reify(tokens: NodeTokens) {
    this.content.reify(tokens);
  }
}
