import { Opcode, OpcodeJSON, UpdatingOpcode } from '../../opcodes';
import { VM, UpdatingVM } from '../../vm';
import * as Simple from '../../dom/interfaces';
import { FIX_REIFICATION } from '../../dom/interfaces';
import { Environment, DynamicScope } from '../../environment';
import { FIXME, Option, Opaque, Dict, dict } from 'glimmer-util';
import {
  CachedReference,
  Reference,
  ReferenceCache,
  RevisionTag,
  Revision,
  PathReference,
  combineTagged,
  isConst as isConstReference,
  isModified
} from 'glimmer-reference';
import { ModifierManager } from '../../modifier/interfaces';
import { NULL_REFERENCE } from '../../references';
import { ValueReference } from '../../compiled/expressions/value';
import { CompiledArgs, EvaluatedArgs } from '../../compiled/expressions/args';
import { IChangeList } from '../../dom/change-lists';
import { ElementOperations } from '../../builder';

export class TextOpcode extends Opcode {
  public type = "text";
  public text: string;

  constructor({ text }: { text: string }) {
    super();
    this.text = text;
  }

  evaluate(vm: VM) {
    vm.stack().appendText(this.text);
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.text)]
    };
  }
}

export class OpenPrimitiveElementOpcode extends Opcode {
  public type = "open-primitive-element";

  constructor(private tag: string) {
    super();
  }

  evaluate(vm: VM) {
    vm.stack().openElement(this.tag);
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.tag)]
    };
  }
}

export class OpenComponentElementOpcode extends Opcode {
  public type = "open-component-element";

  constructor(private tag: string) {
    super();
  }

  evaluate(vm: VM) {
    vm.stack().openElement(this.tag, new ComponentElementOperations(vm.env));
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.tag)]
    };
  }
}

export class OpenDynamicPrimitiveElementOpcode extends Opcode {
  public type = "open-dynamic-primitive-element";

  evaluate(vm: VM) {
    let tagName = vm.frame.getOperand().value();
    vm.stack().openElement(tagName);
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: ["$OPERAND"]
    };
  }
}

class ClassList {
  private list: Reference<string>[] = null;
  private isConst = true;

  append(reference: Reference<string>) {
    let { list, isConst } = this;

    if (list === null) list = this.list = [];

    list.push(reference);
    this.isConst = isConst && isConstReference(reference);
  }

  toReference(): Reference<string> {
    let { list, isConst } = this;

    if (!list) return NULL_REFERENCE;

    if (isConst) return new ValueReference(toClassName(list));

    return new ClassListReference(list);
  }

}

class ClassListReference extends CachedReference<string> {
  public tag: RevisionTag;
  private list: Reference<string>[] = [];

  constructor(list: Reference<string>[]) {
    super();
    this.tag = combineTagged(list);
    this.list = list;
  }

  protected compute(): string {
    return toClassName(this.list);
  }
}

function toClassName(list: Reference<string>[]) {
  let ret = [];

  for (let i = 0; i < list.length; i++) {
    let value: FIXME<Opaque, 'use Opaque and normalize'> = list[i].value();
    if (value !== false && value !== null && value !== undefined) ret.push(value);
  }

  return (ret.length === 0) ? null : ret.join(' ');
}

export class SimpleElementOperations implements ElementOperations {
  private opcodes: UpdatingOpcode[] = null;
  private classList: ClassList = null;

  constructor(private env: Environment) {
  }

  addStaticAttribute(element: Simple.Element, name: string, value: string) {
    if (name === 'class') {
      this.addClass(new ValueReference(value));
    } else {
      this.env.getAppendOperations().setAttribute(element, name, value);
    }
  }

  addStaticAttributeNS(element: Simple.Element, namespace: string, name: string, value: string) {
    this.env.getAppendOperations().setAttribute(element, name, value, namespace);
  }

  addDynamicAttribute(element: Simple.Element, name: string, reference: PathReference<string>, isTrusting: boolean) {
    if (name === 'class') {
      this.addClass(reference);
    } else {
      let attributeManager = this.env.attributeFor(element, name, isTrusting);
      let attribute = new DynamicAttribute(element, attributeManager, name, reference);

      this.addAttribute(attribute);
    }
  }

  addDynamicAttributeNS(element: Simple.Element, namespace: string, name: string, reference: PathReference<string>, isTrusting: boolean) {
    let attributeManager = this.env.attributeFor(element, name,isTrusting, namespace);
    let nsAttribute = new DynamicAttribute(element, attributeManager, name, reference, namespace);

    this.addAttribute(nsAttribute);
  }

  flush(element: Simple.Element, vm: VM) {
    let { env } = vm;
    let { opcodes, classList } = this;

    for (let i = 0; opcodes && i < opcodes.length; i++) {
      vm.updateWith(opcodes[i]);
    }

    if (classList) {
      let attributeManager = env.attributeFor(element, 'class', false);
      let attribute = new DynamicAttribute(element, attributeManager, 'class', classList.toReference());
      let opcode = attribute.flush(env);

      if (opcode) {
        vm.updateWith(opcode);
      }
    }

    this.opcodes = null;
    this.classList = null;
  }

  private addClass(reference: PathReference<string>) {
    let { classList } = this;

    if (!classList) {
      classList = this.classList = new ClassList();
    }

    classList.append(reference);
  }

  private addAttribute(attribute: Attribute) {
    let opcode = attribute.flush(this.env);

    if (opcode) {
      let { opcodes } = this;

      if (!opcodes) {
        opcodes = this.opcodes = [];
      }

      opcodes.push(opcode);
    }
  }
}

export class ComponentElementOperations implements ElementOperations {
  private attributeNames = null;
  private attributes: Attribute[] = null;
  private classList: ClassList = null;

  constructor(private env: Environment) {
  }

  addStaticAttribute(element: Simple.Element, name: string, value: string) {
    if (name === 'class') {
      this.addClass(new ValueReference(value));
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
      let attributeManager = this.env.attributeFor(element, name, isTrusting);
      let attribute = new DynamicAttribute(element, attributeManager, name, reference);

      this.addAttribute(name, attribute);
    }
  }

  addDynamicAttributeNS(element: Simple.Element, namespace: string, name: string, reference: PathReference<string>, isTrusting: boolean) {
    if (this.shouldAddAttribute(name)) {
      let attributeManager = this.env.attributeFor(element, name,isTrusting, namespace);
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

  private shouldAddAttribute(name: string) {
    return !this.attributeNames || this.attributeNames.indexOf(name) === -1;
  }

  private addClass(reference: PathReference<string>) {
    let { classList } = this;

    if (!classList) {
      classList = this.classList = new ClassList();
    }

    classList.append(reference);
  }

  private addAttribute(name: string, attribute: Attribute) {
    let { attributeNames, attributes } = this;

    if (!attributeNames) {
      attributeNames = this.attributeNames = [];
      attributes = this.attributes = [];
    }

    attributeNames.push(name);
    attributes.push(attribute);
  }
}

export class FlushElementOpcode extends Opcode {
  public type = "flush-element";

  evaluate(vm: VM) {
    let stack = vm.stack();

    stack.operations.flush(stack.constructing, vm);
    stack.flushElement();
  }
}

export class CloseElementOpcode extends Opcode {
  public type = "close-element";

  evaluate(vm: VM) {
    vm.stack().closeElement();
  }
}

export interface StaticAttrOptions {
  namespace: string;
  name: string;
  value: string;
}

export class StaticAttrOpcode extends Opcode {
  public type = "static-attr";
  public namespace: string;
  public name: string;
  public value: string;

  constructor({ namespace, name, value }: StaticAttrOptions) {
    super();
    this.namespace = namespace;
    this.name = name;
    this.value = value;
  }

  evaluate(vm: VM) {
    let { name, value, namespace } = this;
    if (namespace) {
      vm.stack().setStaticAttributeNS(namespace, name, value);
    } else {
      vm.stack().setStaticAttribute(name, value);
    }
  }

  toJSON(): OpcodeJSON {
    let { _guid: guid, type, namespace, name, value } = this;

    let details = dict<string>();

    if (namespace) {
      details["namespace"] = JSON.stringify(namespace);
    }

    details["name"] = JSON.stringify(name);
    details["value"] = JSON.stringify(value);

    return { guid, type, details };
  }
}

export class ModifierOpcode extends Opcode {
  public type = "modifier";
  public name: string;
  public args: CompiledArgs;
  private manager: ModifierManager<Opaque>;

  constructor({ name, manager, args }: { name: string, manager: ModifierManager<Opaque>, args: CompiledArgs }) {
    super();
    this.name = name;
    this.manager = manager;
    this.args = args;
  }

  evaluate(vm: VM) {
    let { manager } = this;
    let stack = vm.stack();
    let { constructing: element, dom } = stack;
    let args = this.args.evaluate(vm);
    let dynamicScope = vm.dynamicScope();

    let modifier = manager.install(element as FIX_REIFICATION<Element>, args, dom, dynamicScope);
    let destructor = manager.getDestructor(modifier);

    if (destructor) {
      vm.newDestroyable(destructor);
    }

    vm.updateWith(new UpdateModifierOpcode({
      manager,
      modifier,
      element: element as FIX_REIFICATION<Element>,
      dynamicScope,
      args
    }));
  }

  toJSON(): OpcodeJSON {
    let { _guid: guid, type, name, args } = this;

    let details = dict<string>();

    details["type"] = JSON.stringify(type);
    details["name"] = JSON.stringify(name);
    details["args"] = JSON.stringify(args);

    return { guid, type, details };
  }
}

export class UpdateModifierOpcode extends UpdatingOpcode {
  public type = "update-modifier";

  private element: Element;
  private dynamicScope: DynamicScope;
  private args: EvaluatedArgs;
  private manager: ModifierManager<Opaque>;
  private modifier: Opaque;
  private lastUpdated: Revision;

  constructor({ manager, modifier, element, dynamicScope, args }: { manager: ModifierManager<Opaque>, modifier: Opaque, element: Element, dynamicScope: DynamicScope, args: EvaluatedArgs }) {
    super();
    this.modifier = modifier;
    this.manager = manager;
    this.element = element;
    this.dynamicScope = dynamicScope;
    this.args = args;
    this.tag = args.tag;
    this.lastUpdated = args.tag.value();
  }

  evaluate(vm: UpdatingVM) {
    let { manager, modifier, element, dynamicScope, args, lastUpdated } = this;

    if (!args.tag.validate(lastUpdated)) {
      manager.update(modifier, element, args, vm.dom, dynamicScope);
      this.lastUpdated = args.tag.value();
    }
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.args)]
    };
  }
}

export interface Attribute {
  name: string;
  flush(env: Environment): Option<UpdatingOpcode>;
}

export class StaticAttribute implements Attribute {
  constructor(
    private element: Simple.Element,
    public name: string,
    private value: string,
    private namespace?: string
  ) {}

  flush(env: Environment): Option<UpdatingOpcode> {
    env.getAppendOperations().setAttribute(this.element, this.name, this.value, this.namespace);
    return null;
  }
}

export class DynamicAttribute implements Attribute  {
  private cache: ReferenceCache<Opaque>;

  public tag: RevisionTag;

  constructor(
    private element: Simple.Element,
    private changeList: IChangeList,
    public name: string,
    private reference: Reference<Opaque>,
    private namespace?: string
  ) {
    this.element = element;
    this.reference = reference;
    this.changeList = changeList;
    this.tag = reference.tag;
    this.name = name;
    this.cache = null;
    this.namespace = namespace;
  }

  patch(env: Environment) {
    let { element, cache } = this;

    let value = cache.revalidate();

    if (isModified(value)) {
      this.changeList.updateAttribute(env, element as FIXME<Element, 'needs to be reified properly'>, this.name, value, this.namespace);
    }
  }

  flush(env: Environment): Option<UpdatingOpcode> {
    let { reference, element } = this;

    if (isConstReference(reference)) {
      let value = reference.value();
      this.changeList.setAttribute(env, element, this.name, value, this.namespace);
      return null;
    } else {
      let cache = this.cache = new ReferenceCache(reference);
      let value = cache.peek();
      this.changeList.setAttribute(env, element, this.name, value, this.namespace);
      return new PatchElementOpcode(this);
    }
  }

  toJSON(): Dict<string> {
    let { element, namespace, name, cache } = this;

    let formattedElement = formatElement(element);
    let lastValue = cache.peek() as string;

    if (namespace) {
      return {
        element: formattedElement,
        type: 'attribute',
        namespace,
        name,
        lastValue
      };
    }

    return {
      element: formattedElement,
      type: 'attribute',
      namespace,
      name,
      lastValue
    };
  }
}

function formatElement(element: Simple.Element): string {
  return JSON.stringify(`<${element.tagName.toLowerCase()} />`);
}

export interface DynamicAttrNSOptions {
  name: string;
  namespace: string;
  isTrusting: boolean;
}

export class DynamicAttrNSOpcode extends Opcode {
  public type = "dynamic-attr";
  public name: string;
  public namespace: string;
  public isTrusting: boolean;

  constructor({ name, namespace, isTrusting }: DynamicAttrNSOptions) {
    super();
    this.name = name;
    this.namespace = namespace;
    this.isTrusting = isTrusting;
  }

  evaluate(vm: VM) {
    let { name, namespace, isTrusting } = this;
    let reference = vm.frame.getOperand();
    vm.stack().setDynamicAttributeNS(namespace, name, reference, isTrusting);
  }

  toJSON(): OpcodeJSON {
    let { _guid: guid, type, name, namespace } = this;

    let details = dict<string>();

    details["name"] = JSON.stringify(name);
    details["value"] = "$OPERAND";

    if (namespace) {
      details["namespace"] = JSON.stringify(namespace);
    }

    return { guid, type, details };
  }
}

export interface SimpleAttrOptions {
  name: string;
  isTrusting: boolean;
}

export class DynamicAttrOpcode extends Opcode {
  public type = "dynamic-attr";
  public name: string;
  public isTrusting: boolean;

  constructor({ name, isTrusting }: SimpleAttrOptions) {
    super();
    this.name = name;
    this.isTrusting = isTrusting;
  }

  evaluate(vm: VM) {
    let { name, isTrusting } = this;
    let reference = vm.frame.getOperand();
    vm.stack().setDynamicAttribute(name, reference, isTrusting);
  }

  toJSON(): OpcodeJSON {
    let { _guid: guid, type, name } = this;

    let details = dict<string>();

    details["name"] = JSON.stringify(name);
    details["value"] = "$OPERAND";

    return { guid, type, details };
  }
}

export class PatchElementOpcode extends UpdatingOpcode {
  public type = "patch-element";

  private operation: DynamicAttribute;

  constructor(operation: DynamicAttribute) {
    super();
    this.tag = operation.tag;
    this.operation = operation;
  }

  evaluate(vm: UpdatingVM) {
    this.operation.patch(vm.env);
  }

  toJSON(): OpcodeJSON {
    let { _guid, type, operation } = this;

    return {
      guid: _guid,
      type,
      details: operation.toJSON()
    };
  }
}

export interface CommentOptions {
  comment: string;
}

export class CommentOpcode extends Opcode {
  public type = "comment";
  public comment: string;

  constructor({ comment }: CommentOptions) {
    super();
    this.comment = comment;
  }

  evaluate(vm: VM) {
    vm.stack().appendComment(this.comment);
  }

  toJSON(): OpcodeJSON {
    return {
      guid: this._guid,
      type: this.type,
      args: [JSON.stringify(this.comment)]
    };
  }
}
