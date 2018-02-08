import {
  Revision,
  Tag,
  VersionedReference,
  isConstTag
} from '@glimmer/reference';
import { Opaque } from '@glimmer/util';
import { check } from '@glimmer/debug';
import { Simple } from '@glimmer/interfaces';
import { Op } from '@glimmer/vm';
import { Modifier, ModifierManager } from '../../modifier/interfaces';
import { APPEND_OPCODES, UpdatingOpcode } from '../../opcodes';
import { UpdatingVM } from '../../vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { CheckArguments } from './-debug-strip';

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  let manager = vm.constants.resolveHandle<ModifierManager>(handle);
  let stack = vm.stack;
  let args = check(stack.pop(), CheckArguments);
  let { constructing: element, updateOperations } = vm.elements();
  let dynamicScope = vm.dynamicScope();
  let modifier = manager.create(element as Simple.FIX_REIFICATION<Element>, args, dynamicScope, updateOperations);

  vm.env.scheduleInstallModifier(modifier, manager);
  let destructor = manager.getDestructor(modifier);

  if (destructor) {
    vm.newDestroyable(destructor);
  }

  let tag = manager.getTag(modifier);

  if (!isConstTag(tag)) {
    vm.updateWith(new UpdateModifierOpcode(
      tag,
      manager,
      modifier
    ));
  }
});

export class UpdateModifierOpcode extends UpdatingOpcode {
  public type = 'update-modifier';
  private lastUpdated: Revision;

  constructor(
    public tag: Tag,
    private manager: ModifierManager,
    private modifier: Modifier,
  ) {
    super();
    this.lastUpdated = tag.value();
  }

  evaluate(vm: UpdatingVM) {
    let { manager, modifier, tag, lastUpdated } = this;

    if (!tag.validate(lastUpdated)) {
      vm.env.scheduleUpdateModifier(modifier, manager);
      this.lastUpdated = tag.value();
    }
  }
}

export class UpdateDynamicAttributeOpcode extends UpdatingOpcode {
  public type = 'patch-element';

  public tag: Tag;
  public lastRevision: number;

  constructor(private reference: VersionedReference<Opaque>, private attribute: DynamicAttribute) {
    super();
    this.tag = reference.tag;
    this.lastRevision = this.tag.value();
  }

  evaluate(vm: UpdatingVM) {
    let { attribute, reference, tag } = this;
    if (!tag.validate(this.lastRevision)) {
      this.lastRevision = tag.value();
      attribute.update(reference.value(), vm.env);
    }
  }
}
