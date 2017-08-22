import {
  Reference,
  ReferenceCache,
  Revision,
  Tag,
  VersionedReference,
  isConst,
  isConstTag
} from '@glimmer/reference';
import { Opaque, Option } from '@glimmer/util';
import { Simple } from '@glimmer/interfaces';
import { Op, Register } from '@glimmer/vm';
import { Modifier as IModifier, ModifierManager } from '../../modifier/interfaces';
import { UpdatingOpcode } from '../../opcodes';
import { UpdatingVM, VM } from '../../vm';
import { Arguments } from '../../vm/arguments';
import { Assert } from './vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { ComponentElementOperations } from './component';
import { Opcode }from '../../environment';

export const DOM_MAPPINGS = {};

export function Text(vm: VM, { op1: text }: Opcode) {
  vm.elements().appendText(vm.constants.getString(text));
}

DOM_MAPPINGS[Op.Text] = Text;

export function Comment(vm: VM, { op1: text }: Opcode) {
  vm.elements().appendComment(vm.constants.getString(text));
}

DOM_MAPPINGS[Op.Comment] = Comment;

export function OpenElement(vm: VM, { op1: tag }: Opcode) {
  vm.elements().openElement(vm.constants.getString(tag));
}

export function OpenDynamicElement(vm: VM) {
  let tagName = vm.stack.pop<Reference<string>>().value();
  vm.elements().openElement(tagName);
}

DOM_MAPPINGS[Op.OpenDynamicElement] = OpenDynamicElement;

export function PushRemoteElement(vm: VM) {
  let elementRef = vm.stack.pop<Reference<Simple.Element>>();
  let nextSiblingRef = vm.stack.pop<Reference<Option<Simple.Node>>>();

  let element: Simple.Element;
  let nextSibling: Option<Simple.Node>;

  if (isConst(elementRef)) {
    element = elementRef.value();
  } else {
    let cache = new ReferenceCache(elementRef);
    element = cache.peek();
    vm.updateWith(new Assert(cache));
  }

  if (isConst(nextSiblingRef)) {
    nextSibling = nextSiblingRef.value();
  } else {
    let cache = new ReferenceCache(nextSiblingRef);
    nextSibling = cache.peek();
    vm.updateWith(new Assert(cache));
  }

  vm.elements().pushRemoteElement(element, nextSibling);
}

DOM_MAPPINGS[Op.PushRemoteElement] = PushRemoteElement;

export function PopRemoteElement(vm: VM){ vm.elements().popRemoteElement(); }

DOM_MAPPINGS[Op.PopRemoteElement] = PopRemoteElement;

export function FlushElement(vm: VM) {
  let operations = vm.fetchValue<ComponentElementOperations>(Register.t0);

  if (operations) {
    operations.flush(vm);
    vm.loadValue(Register.t0, null);
  }

  vm.elements().flushElement();
}

DOM_MAPPINGS[Op.FlushElement] = FlushElement;

export function CloseElement(vm: VM) { vm.elements().closeElement(); }

DOM_MAPPINGS[Op.CloseElement] = CloseElement;

export function Modifier(vm: VM, { op1: specifier }: Opcode) {
  let manager = vm.constants.resolveSpecifier<ModifierManager>(specifier);
  let stack = vm.stack;
  let args = stack.pop<Arguments>();
  let { constructing: element, updateOperations } = vm.elements();
  let dynamicScope = vm.dynamicScope();
  let modifier = manager.create(element as Simple.FIX_REIFICATION<Element>, args, dynamicScope, updateOperations);

  args.clear();

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
}

DOM_MAPPINGS[Op.Modifier] = Modifier;

export class UpdateModifierOpcode extends UpdatingOpcode {
  public type = 'update-modifier';
  private lastUpdated: Revision;

  constructor(
    public tag: Tag,
    private manager: ModifierManager,
    private modifier: IModifier,
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

export function StaticAttr(vm: VM, { op1: _name, op2: _value, op3: _namespace }: Opcode) {
  let name = vm.constants.getString(_name);
  let value = vm.constants.getString(_value);
  let namespace = _namespace ? vm.constants.getString(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
}

DOM_MAPPINGS[Op.StaticAttr] = StaticAttr;

export function DynamicAttr(vm: VM, { op1: _name, op2: trusting, op3: _namespace }: Opcode) {
  let name = vm.constants.getString(_name);
  let reference = vm.stack.pop<VersionedReference<Opaque>>();
  let value = reference.value();
  let namespace = _namespace ? vm.constants.getString(_namespace) : null;

  let attribute = vm.elements().setDynamicAttribute(name, value, !!trusting, namespace);

  if (!isConst(reference)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute));
  }
}

DOM_MAPPINGS[Op.DynamicAttr] = DynamicAttr;

export class UpdateDynamicAttributeOpcode extends UpdatingOpcode {
  public type = 'patch-element';

  public tag: Tag;

  constructor(private reference: VersionedReference<Opaque>, private attribute: DynamicAttribute) {
    super();
    this.tag = reference.tag;
  }

  evaluate(vm: UpdatingVM) {
    let { attribute, reference } = this;
    attribute.update(reference.value(), vm.env);
  }
}
