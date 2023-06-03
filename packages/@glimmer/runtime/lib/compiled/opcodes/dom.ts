import {
  check,
  CheckElement,
  CheckMaybe,
  CheckNode,
  CheckOption,
  CheckString,
} from '@glimmer/debug';
import type {
  AttributeOperation,
  AttributeRef,
  BrowserTreeBuilderInterface,
  CapturedPositionalArguments,
  Maybe,
  MinimalChild,
  MinimalCursor,
  MinimalElement,
  ModifierDefinition,
  ModifierDefinitionState,
  PropRef,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import { createComputeRef, isConstRef, type Reference, valueForRef } from '@glimmer/reference';
import { debugToString, expect, isObject } from '@glimmer/util';
import { createCache, consumeTag } from '@glimmer/validator';
import {
  $t0,
  CLOSE_ELEMENT_OP,
  COMMENT_OP,
  DYNAMIC_ATTR_OP,
  DYNAMIC_MODIFIER_OP,
  FLUSH_ELEMENT_OP,
  MODIFIER_OP,
  OPEN_DYNAMIC_ELEMENT_OP,
  OPEN_ELEMENT_OP,
  POP_REMOTE_ELEMENT_OP,
  PUSH_REMOTE_ELEMENT_OP,
  STATIC_ATTR_OP,
  TEXT_OP,
  CURRIED_MODIFIER,
} from '@glimmer/vm-constants';

import { type CurriedValue, isCurriedType, resolveCurriedValue } from '../../curried-value';
import { define } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import { CheckArguments, CheckOperations, CheckReference } from './-debug-strip';
import { Assert } from './vm';
import { dynamicAttribute } from '../../..';
import { REF_ELEMENT } from '../../dom/tree-builder';

define(TEXT_OP, (vm, { op1: text }) => {
  vm._elements_().text(vm[CONSTANTS].getValue(text));
});

define(COMMENT_OP, (vm, { op1: text }) => {
  vm._elements_().comment(vm[CONSTANTS].getValue(text));
});

define(OPEN_ELEMENT_OP, (vm, { op1: tag }) => {
  vm._elements_().startElement(vm[CONSTANTS].getValue(tag));
});

define(OPEN_DYNAMIC_ELEMENT_OP, (vm) => {
  let tagName = check(valueForRef(check(vm.stack.pop(), CheckReference)), CheckString);
  vm._elements_().startElement(tagName);
});

define(PUSH_REMOTE_ELEMENT_OP, (vm) => {
  let elementReference = check(vm.stack.pop(), CheckReference);
  let insertBeforeReference = check(vm.stack.pop(), CheckReference);
  let guidReference = check(vm.stack.pop(), CheckReference);

  let element = check(valueForRef(elementReference), CheckElement) as unknown as MinimalElement;
  let insertBefore = check(
    valueForRef(insertBeforeReference),
    CheckMaybe(CheckOption(CheckNode))
  ) as Maybe<MinimalChild>;
  let guid = valueForRef(guidReference) as string;

  if (!isConstRef(elementReference)) {
    vm._updateWith_(new Assert(elementReference));
  }

  if (insertBefore !== undefined && !isConstRef(insertBeforeReference)) {
    vm._updateWith_(new Assert(insertBeforeReference));
  }

  vm._elements_().startInElement([element, insertBefore] as MinimalCursor, guid);
});

define(POP_REMOTE_ELEMENT_OP, (vm) => {
  let block = vm._elements_().endInElement();
  if (block) vm._associateDestroyable_(block);
});

define(FLUSH_ELEMENT_OP, (vm) => {
  let operations = check(vm._fetchValue_($t0), CheckOperations);

  if (operations) {
    let modifiers = operations.flush(vm);
    vm._loadValue_($t0, null);
    let parent = vm._getDestroyableParent_();

    for (let modifier of modifiers) {
      vm.env.scheduleInstallModifier(modifier, parent);
    }
  } else {
    vm._elements_().flushElement();
  }
});

define(CLOSE_ELEMENT_OP, (vm) => {
  let element = vm._elements_().endElement();
  vm.env.didAppend(element as Element);
});

define(MODIFIER_OP, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let args = check(vm.stack.pop(), CheckArguments);
  let definition = vm[CONSTANTS].getValue<ModifierDefinition>(handle);

  let operations = expect(
    check(vm._fetchValue_($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  let owner = vm._getOwner_();
  let modifier = operations.addModifier(
    createCache(() => ({ definition, owner }), 'modifier definition'),
    args.capture()
  );

  consumeTag(modifier.tag);
  return vm._updateWith_(modifier);
});

define(DYNAMIC_MODIFIER_OP, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack, [CONSTANTS]: constants } = vm;
  let reference = check(stack.pop(), CheckReference);
  let args = check(stack.pop(), CheckArguments).capture();
  let currentOwner = vm._getOwner_();

  let cache = createCache(() => {
    let value = valueForRef(reference);
    let owner = currentOwner;

    if (!isObject(value)) {
      return {
        definition: undefined,
        owner,
      };
    }

    let hostDefinition: CurriedValue | ModifierDefinitionState;

    if (isCurriedType(value, CURRIED_MODIFIER)) {
      let {
        definition: resolvedDefinition,
        owner: curriedOwner,
        positional,
        named,
      } = resolveCurriedValue(value);

      hostDefinition = resolvedDefinition;
      owner = curriedOwner;

      if (positional !== undefined) {
        args.positional = [...positional, ...args.positional] as CapturedPositionalArguments;
      }

      if (named !== undefined) {
        args.named = Object.assign({}, ...named, args.named);
      }
    } else {
      hostDefinition = value;
    }

    let handle = constants.modifier(hostDefinition, null, true);

    if (import.meta.env.DEV && handle === null) {
      throw new Error(
        `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${
          reference.debugLabel
        }}}\`, and the incorrect definition is the value at the path \`${
          reference.debugLabel
        }\`, which was: ${debugToString!(hostDefinition)}`
      );
    }

    return {
      definition: constants.getValue<ModifierDefinition>(
        expect(handle, 'BUG: modifier handle expected')
      ),
      owner,
    };
  }, 'DynamicModifierDefinition');

  let operations = expect(
    check(vm._fetchValue_($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  let modifier = operations.addModifier(cache, args);
  consumeTag(modifier.tag);

  return vm._updateWith_(modifier);
});

define(STATIC_ATTR_OP, (vm, { op1: _name, op2: _value }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);

  vm._elements_().addAttr(name, value);
});

define(DYNAMIC_ATTR_OP, (vm, { op1: _name, op2: _trusting }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = check(vm.stack.pop(), CheckReference);
  let value = valueForRef(reference);

  let dom = vm._elements_() as BrowserTreeBuilderInterface;
  let tag = dom._currentTag_ as string;


  let attribute = dynamicAttribute(dom, tag, name, trusting);

  let ref = attribute.client(dom, value);
  if (!isConstRef(reference)) {
    vm._updateWith_(new UpdateDynamicAttributeOpcode(reference, attribute, ref));
  }
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  readonly #updateRef: Reference;
  readonly #opRef: AttributeRef | PropRef;

  // FIXME: element should turn into a reference inside of AttributeOperation (like modifiers),
  // which ultimately will fix SSR.
  constructor(
    reference: Reference<unknown>,
    attribute: AttributeOperation,
    opRef: AttributeRef | PropRef
  ) {
    this.#opRef = opRef;
    let initialized = false;

    this.#updateRef = createComputeRef(() => {
      let value = valueForRef(reference);
      if (initialized === true) {
        let element = this.#opRef[REF_ELEMENT];
        if (element) attribute.update(element, value);
      } else {
        initialized = true;
      }
    });

    valueForRef(this.#updateRef);
  }

  evaluate() {
    valueForRef(this.#updateRef);
  }
}
