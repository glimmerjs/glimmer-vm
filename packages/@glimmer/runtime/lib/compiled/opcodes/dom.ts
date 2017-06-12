import {
  isConst as isConstReference,
  PathReference,
  Reference,
  ReferenceCache,
  Revision,
  Tag,
  VersionedReference,
  isConst,
} from '@glimmer/reference';
import { Opaque, Option, unwrap, unreachable } from '@glimmer/util';
import { ElementOperations, ElementBuilder } from '../../vm/element-builder';
import { Simple } from '@glimmer/interfaces';
import { FIX_REIFICATION } from '../../dom/interfaces';
import { normalizeStringValue } from '../../dom/normalize';
import { Environment } from '../../environment';
import { ModifierManager } from '../../modifier/interfaces';
import { APPEND_OPCODES, Op, OpcodeJSON, UpdatingOpcode } from '../../opcodes';
import { PrimitiveReference } from '../../references';
import { UpdatingVM, VM } from '../../vm';
import { Arguments } from '../../vm/arguments';
import { Assert } from './vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { AttributeOperation, Attribute } from '../../vm/attributes/index';

APPEND_OPCODES.add(Op.Text, (vm, { op1: text }) => {
  vm.elements().appendText(vm.constants.getString(text));
});

APPEND_OPCODES.add(Op.Comment, (vm, { op1: text }) => {
  vm.elements().appendComment(vm.constants.getString(text));
});

APPEND_OPCODES.add(Op.OpenElement, (vm, { op1: tag }) => {
  vm.elements().openElement(vm.constants.getString(tag));
});

APPEND_OPCODES.add(Op.OpenElementWithOperations, (vm, { op1: tag }) => {
  let tagName = vm.constants.getString(tag);
  let operations = vm.stack.pop<ElementOperations>();
  vm.elements().openElement(tagName, operations);
});

APPEND_OPCODES.add(Op.OpenDynamicElement, vm => {
  let operations = vm.stack.pop<ElementOperations>();
  let tagName = vm.stack.pop<Reference<string>>().value();
  vm.elements().openElement(tagName, operations);
});

APPEND_OPCODES.add(Op.PushRemoteElement, vm => {
  let elementRef = vm.stack.pop<Reference<Simple.Element>>();
  let nextSiblingRef = vm.stack.pop<Reference<Option<Simple.Node>>>();

  let element: Simple.Element;
  let nextSibling: Option<Simple.Node>;

  if (isConstReference(elementRef)) {
    element = elementRef.value();
  } else {
    let cache = new ReferenceCache(elementRef);
    element = cache.peek();
    vm.updateWith(new Assert(cache));
  }

  if (isConstReference(nextSiblingRef)) {
    nextSibling = nextSiblingRef.value();
  } else {
    let cache = new ReferenceCache(nextSiblingRef);
    nextSibling = cache.peek();
    vm.updateWith(new Assert(cache));
  }

  vm.elements().pushRemoteElement(element, nextSibling);
});

APPEND_OPCODES.add(Op.PopRemoteElement, vm => vm.elements().popRemoteElement());

class DynamicClass implements AttributeOperation {
  constructor(public attribute: Attribute & { name: 'class' }, private list: Simple.TokenList, private lastValue: string) {}

  set(dom: ElementBuilder, value: Opaque) {
    dom.__addClass(normalizeStringValue(value));
  }

  update(value: Opaque) {
    let { list, lastValue } = this;
    let newValue = normalizeStringValue(value);

    if (lastValue === newValue) {
      return;
    } else if (lastValue && !newValue) {
      list.remove(lastValue);
    } else if (!lastValue && newValue) {
      list.add(newValue);
    } else {
      throw unreachable();
    }
  }
}

export class SimpleElementOperations implements ElementOperations {
  constructor(private env: Environment, private builder: ElementBuilder) {
  }

  addStaticAttribute(element: Simple.Element, name: string, value: string) {
    if (name === 'class') {
      let classList = this.env.getAppendOperations().getClassList(element);
      classList.add(value);
    } else {
      this.builder.__setAttribute(name, value);
    }
  }

  addStaticAttributeNS(element: Simple.Element, namespace: string, name: string, value: string) {
    this.builder.__setAttributeNS(name, value, namespace);
  }

  addDynamicAttribute(element: Simple.Element, name: string, reference: Reference<string>, isTrusting: boolean): DynamicAttribute {
    if (name === 'class') {
      let value = reference.value();
      let classList = this.env.getAppendOperations().getClassList(element);
      classList.add(value);

      return new DynamicClass({ element, name, namespace: null }, this.env.getAppendOperations().getClassList(element), value);

    } else {
      let DynamicAttribute = this.env.attributeFor(element, name, isTrusting);
      let dynamicAttribute = new DynamicAttribute({ element, name, namespace: null });

      let value = reference.value();
      this.builder.__setAttribute(name, value);

      return dynamicAttribute;
    }
  }

  addDynamicAttributeNS(element: Simple.Element, namespace: Simple.Namespace, name: string, reference: PathReference<string>, isTrusting: boolean) {
    let DynamicAttribute = this.env.attributeFor(element, name, isTrusting);
    let dynamicAttribute = new DynamicAttribute({ element, name, namespace });

    let value = reference.value();
    this.builder.__setAttribute(name, value);

    return dynamicAttribute;
  }

  flush(element: Simple.Element, vm: VM) {
  }
}

export class ComponentElementOperations implements ElementOperations {
  private attributeNames: Option<string[]> = null;
  private attributes: Option<DynamicAttribute[]> = null;
  private classList: Option<ConstructingClassList> = null;

  constructor(private env: Environment) {
  }

  addStaticAttribute(element: Simple.Element, name: string, value: string) {
    if (name === 'class') {
      this.addClass(PrimitiveReference.create(value));
    } else if (this.shouldAddAttribute(name)) {
      this.addAttribute(name, new StaticAttribute(element, name, value));
    }
  }

  addStaticAttributeNS(element: Simple.Element, namespace: string, name: string, value: string) {
    if (this.shouldAddAttribute(name)) {
      this.addAttribute(name, new StaticAttribute(element, name, value, namespace));
    }
  }

  addDynamicAttribute(element: Simple.Element, name: string, reference: PathReference<string>, isTrusting: boolean) {
    if (name === 'class') {
      this.addClass(reference);
    } else if (this.shouldAddAttribute(name)) {
      let DynamicAttribute = this.env.attributeFor(element, name, isTrusting);
      let attribute = new DynamicAttribute({ element, name, namespace: null });

      this.addAttribute(name, attribute);

      return attribute;
    }
  }

  addDynamicAttributeNS(element: Simple.Element, namespace: Simple.Namespace, name: string, reference: PathReference<string>, isTrusting: boolean) {
    if (this.shouldAddAttribute(name)) {
      let attributeManager = this.env.attributeFor(element, name, isTrusting, namespace);
      let nsAttribute = new DynamicAttribute(element, attributeManager, name, reference, namespace);

      this.addAttribute(name, nsAttribute);
    }
  }

  flush(element: Simple.Element, vm: VM) {
    let { env } = this;
    let { attributes, classList } = this;

    for (let i = 0; attributes && i < attributes.length; i++) {
      let opcode = attributes[i].flush(env);

      if (opcode) {
        vm.updateWith(opcode);
      }
    }

    if (classList) {
      let attributeManager = env.attributeFor(element, 'class', false);
      let attribute = new DynamicAttribute(element, attributeManager, 'class', classList.toReference());
      let opcode = attribute.flush(env);

      if (opcode) {
        vm.updateWith(opcode);
      }
    }
  }

  private shouldAddAttribute(name: string): boolean {
    return !this.attributeNames || this.attributeNames.indexOf(name) === -1;
  }

  private addClass(reference: PathReference<string>) {
    let { classList } = this;

    if (!classList) {
      classList = this.classList = new ConstructingClassList();
    }

    classList.append(reference);
  }

  private addAttribute(name: string, attribute: DynamicAttribute) {
    let { attributeNames, attributes } = this;

    if (!attributeNames) {
      attributeNames = this.attributeNames = [];
      attributes = this.attributes = [];
    }

    attributeNames.push(name);
    unwrap(attributes).push(attribute);
  }
}

APPEND_OPCODES.add(Op.FlushElement, vm => {
  let stack = vm.elements();

  let action = 'FlushElementOpcode#evaluate';
  stack.expectOperations(action).flush(stack.expectConstructing(action), vm);
  stack.flushElement();
});

APPEND_OPCODES.add(Op.CloseElement, vm => vm.elements().closeElement());

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: _manager }) => {
  let manager = vm.constants.getOther<ModifierManager<Opaque>>(_manager);
  let stack = vm.stack;
  let args = stack.pop<Arguments>();
  let tag = args.tag;
  let { constructing: element, updateOperations } = vm.elements();
  let dynamicScope = vm.dynamicScope();
  let modifier = manager.create(element as FIX_REIFICATION<Element>, args, dynamicScope, updateOperations);

  args.clear();

  vm.env.scheduleInstallModifier(modifier, manager);
  let destructor = manager.getDestructor(modifier);

  if (destructor) {
    vm.newDestroyable(destructor);
  }

  vm.updateWith(new UpdateModifierOpcode(
    tag,
    manager,
    modifier,
  ));
});

export class UpdateModifierOpcode extends UpdatingOpcode {
  public type = 'update-modifier';
  private lastUpdated: Revision;

  constructor(
    public tag: Tag,
    private manager: ModifierManager<Opaque>,
    private modifier: Opaque,
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

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
    };
  }
}

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm.constants.getString(_name);
  let value = vm.constants.getString(_value);

  if (_namespace) {
    let namespace = vm.constants.getString(_namespace);
    vm.elements().setStaticAttributeNS(namespace, name, value);
  } else {
    vm.elements().setStaticAttribute(name, value);
  }
});

APPEND_OPCODES.add(Op.DynamicAttrNS, (vm, { op1: _name, op2: _namespace, op3: trusting }) => {
  let name = vm.constants.getString(_name);
  let namespace = vm.constants.getString(_namespace);
  let reference = vm.stack.pop<VersionedReference<string>>();

  let attribute = vm.elements().setDynamicAttribute(namespace, name, reference, !!trusting);

  if (!isConst(reference)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute));
  }
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: trusting }) => {
  let name = vm.constants.getString(_name);
  let reference = vm.stack.pop<VersionedReference<Opaque>>();

  let attribute = vm.elements().setDynamicAttribute(name, reference, !!trusting);

  if (!isConst(reference)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute));
  }
});

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
