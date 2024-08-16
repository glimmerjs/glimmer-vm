import type {
  CapturedPositionalArguments,
  Environment,
  Maybe,
  ModifierDefinition,
  ModifierDefinitionState,
  ModifierInstance,
  Nullable,
  Owner,
  SimpleElement,
  SimpleNode,
  UpdatingOpcode,
  UpdatingVM,
} from '@glimmer/interfaces';
import type { Reference } from '@glimmer/reference';
import type { Revision, Tag } from '@glimmer/validator';
import { associateDestroyableChild, destroy, registerDestructor } from '@glimmer/destroyable';
import { getInternalModifierManager } from '@glimmer/manager';
import { createComputeRef, isConstRef, valueForRef } from '@glimmer/reference';
import { debugToString, expect, isObject } from '@glimmer/util';
import { consumeTag, CURRENT_TAG, validateTag, valueForTag } from '@glimmer/validator';
import { $t0, CurriedTypes, Op } from '@glimmer/vm';

import type { CurriedValue } from '../../curried-value';
import type { DynamicAttribute } from '../../vm/attributes/dynamic';

import { isCurriedType, resolveCurriedValue } from '../../curried-value';
import { APPEND_OPCODES } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import { createCapturedArgs } from '../../vm/arguments';
import { Assert } from './vm';

APPEND_OPCODES.add(Op.Text, (vm, { op1: text }) => {
  vm.elements().appendText(vm[CONSTANTS].getValue(text));
});

APPEND_OPCODES.add(Op.Comment, (vm, { op1: text }) => {
  vm.elements().appendComment(vm[CONSTANTS].getValue(text));
});

APPEND_OPCODES.add(Op.OpenElement, (vm, { op1: tag }) => {
  vm.elements().openElement(vm[CONSTANTS].getValue(tag));
});

APPEND_OPCODES.add(Op.OpenDynamicElement, (vm) => {
  // @ts-expect-error todo
  let tagName = valueForRef(vm.stack.pop());
  // @ts-expect-error todo
  vm.elements().openElement(tagName);
});

APPEND_OPCODES.add(Op.PushRemoteElement, (vm) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let elementRef = vm.stack.pop() as Reference<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let insertBeforeRef = vm.stack.pop() as Reference<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let guidRef = vm.stack.pop() as Reference<string>;

  let element = valueForRef(elementRef) as SimpleElement;
  let insertBefore = valueForRef(insertBeforeRef) as Maybe<SimpleNode>;
  let guid = valueForRef(guidRef);

  if (!isConstRef(elementRef)) {
    vm.updateWith(new Assert(elementRef));
  }

  if (insertBefore !== undefined && !isConstRef(insertBeforeRef)) {
    vm.updateWith(new Assert(insertBeforeRef));
  }

  let block = vm.elements().pushRemoteElement(element, guid, insertBefore);
  if (block) vm.associateDestroyable(block);

  if (vm.env.debugRenderTree !== undefined) {
    // Note that there is nothing to update – when the args for an
    // {{#in-element}} changes it gets torn down and a new one is
    // re-created/rendered in its place (see the `Assert`s above)
    let args = createCapturedArgs(
      insertBefore === undefined ? {} : { insertBefore: insertBeforeRef },
      [elementRef]
    );

    vm.env.debugRenderTree.create(block, {
      type: 'keyword',
      name: 'in-element',
      args,
      instance: null,
    });

    registerDestructor(block, () => {
      vm.env.debugRenderTree?.willDestroy(block);
    });
  }
});

APPEND_OPCODES.add(Op.PopRemoteElement, (vm) => {
  let bounds = vm.elements().popRemoteElement();

  if (vm.env.debugRenderTree !== undefined) {
    // The RemoteLiveBlock is also its bounds
    vm.env.debugRenderTree.didRender(bounds, bounds);
  }
});

APPEND_OPCODES.add(Op.FlushElement, (vm) => {
  let operations = vm.fetchValue($t0);
  let modifiers: Nullable<ModifierInstance[]> = null;

  if (operations) {
    // @ts-expect-error todo
    modifiers = operations.flush(vm);
    vm.loadValue($t0, null);
  }

  vm.elements().flushElement(modifiers);
});

APPEND_OPCODES.add(Op.CloseElement, (vm) => {
  let modifiers = vm.elements().closeElement();

  if (modifiers !== null) {
    modifiers.forEach((modifier) => {
      vm.env.scheduleInstallModifier(modifier);
      const d = modifier.manager.getDestroyable(modifier.state);

      if (d !== null) {
        vm.associateDestroyable(d);
      }
    });
  }
});

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let owner = vm.getOwner();
  let args = vm.stack.pop();
  let definition = vm[CONSTANTS].getValue<ModifierDefinition>(handle);

  let { manager } = definition;

  let { constructing } = vm.elements();

  // @ts-expect-error todo
  let capturedArgs = args.capture();
  let state = manager.create(
    owner,
    expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
    definition.state,
    capturedArgs
  );

  let instance: ModifierInstance = {
    manager,
    state,
    definition,
  };

  let operations = expect(
    vm.fetchValue($t0),
    'BUG: ElementModifier could not find operations to append to'
  );

  // @ts-expect-error todo
  operations.addModifier(vm, instance, capturedArgs);

  let tag = manager.getTag(state);

  if (tag !== null) {
    consumeTag(tag);
    return vm.updateWith(new UpdateModifierOpcode(tag, instance));
  }
});

APPEND_OPCODES.add(Op.DynamicModifier, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack } = vm;
  let ref = stack.pop();
  let args = stack.pop();
  // @ts-expect-error todo
  let { positional: outerPositional, named: outerNamed } = args;

  let { constructing } = vm.elements();
  let initialOwner = vm.getOwner();

  let instanceRef = createComputeRef(() => {
    // @ts-expect-error todo
    let value = valueForRef(ref);
    let owner: Owner;

    if (!isObject(value)) {
      return;
    }

    let hostDefinition: CurriedValue | ModifierDefinitionState;

    if (isCurriedType(value, CurriedTypes.Modifier)) {
      let {
        definition: resolvedDefinition,
        owner: curriedOwner,
        positional,
        named,
      } = resolveCurriedValue(value);

      hostDefinition = resolvedDefinition;
      owner = curriedOwner;

      if (positional !== undefined) {
        // @ts-expect-error todo
        args.positional = positional.concat(outerPositional) as CapturedPositionalArguments;
      }

      if (named !== undefined) {
        // @ts-expect-error todo
        args.named = Object.assign({}, ...named, outerNamed);
      }
    } else {
      hostDefinition = value;
      owner = initialOwner;
    }

    let manager = getInternalModifierManager(hostDefinition, true);

    if (manager === null) {
      if (import.meta.env.DEV) {
        throw new Error(
          `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${
            // @ts-expect-error todo
            ref.debugLabel
          }}}\`, and the incorrect definition is the value at the path \`${
            // @ts-expect-error todo
            ref.debugLabel
          }\`, which was: ${debugToString!(hostDefinition)}`
        );
      } else {
        throw new Error('BUG: modifier manager expected');
      }
    }

    let definition = {
      resolvedName: null,
      manager,
      state: hostDefinition,
    };

    let state = manager.create(
      owner,
      expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
      definition.state,
      // @ts-expect-error todo
      args
    );

    return {
      manager,
      state,
      definition,
    };
  });

  let instance = valueForRef(instanceRef);
  let tag = null;

  if (instance !== undefined) {
    let operations = expect(
      vm.fetchValue($t0),
      'BUG: ElementModifier could not find operations to append to'
    );

    // @ts-expect-error todo
    operations.addModifier(vm, instance, args);

    tag = instance.manager.getTag(instance.state);

    if (tag !== null) {
      consumeTag(tag);
    }
  }

  // @ts-expect-error todo
  if (!isConstRef(ref) || tag) {
    return vm.updateWith(new UpdateDynamicModifierOpcode(tag, instance, instanceRef));
  }
});

export class UpdateModifierOpcode implements UpdatingOpcode {
  private lastUpdated: Revision;

  constructor(
    private tag: Tag,
    private modifier: ModifierInstance
  ) {
    this.lastUpdated = valueForTag(tag);
  }

  evaluate(vm: UpdatingVM) {
    let { modifier, tag, lastUpdated } = this;

    consumeTag(tag);

    if (!validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(modifier);
      this.lastUpdated = valueForTag(tag);
    }
  }
}

export class UpdateDynamicModifierOpcode implements UpdatingOpcode {
  private lastUpdated: Revision;

  constructor(
    private tag: Tag | null,
    private instance: ModifierInstance | undefined,
    private instanceRef: Reference<ModifierInstance | undefined>
  ) {
    this.lastUpdated = valueForTag(tag ?? CURRENT_TAG);
  }

  evaluate(vm: UpdatingVM) {
    let { tag, lastUpdated, instance, instanceRef } = this;

    let newInstance = valueForRef(instanceRef);

    if (newInstance !== instance) {
      if (instance !== undefined) {
        let destroyable = instance.manager.getDestroyable(instance.state);

        if (destroyable !== null) {
          destroy(destroyable);
        }
      }

      if (newInstance !== undefined) {
        let { manager, state } = newInstance;
        let destroyable = manager.getDestroyable(state);

        if (destroyable !== null) {
          associateDestroyableChild(this, destroyable);
        }

        tag = manager.getTag(state);

        if (tag !== null) {
          this.lastUpdated = valueForTag(tag);
        }

        this.tag = tag;
        vm.env.scheduleInstallModifier(newInstance);
      }

      this.instance = newInstance;
    } else if (tag !== null && !validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(instance!);
      this.lastUpdated = valueForTag(tag);
    }

    if (tag !== null) {
      consumeTag(tag);
    }
  }
}

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = vm.stack.pop();

  // @ts-expect-error todo
  let value = valueForRef(reference);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  let attribute = vm.elements().setDynamicAttribute(name, value, trusting, namespace);

  // @ts-expect-error todo
  if (!isConstRef(reference)) {
    // @ts-expect-error todo
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute, vm.env));
  }
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  private updateRef: Reference;

  constructor(reference: Reference<unknown>, attribute: DynamicAttribute, env: Environment) {
    let initialized = false;

    this.updateRef = createComputeRef(() => {
      let value = valueForRef(reference);

      if (initialized === true) {
        attribute.update(value, env);
      } else {
        initialized = true;
      }
    });

    valueForRef(this.updateRef);
  }

  evaluate() {
    valueForRef(this.updateRef);
  }
}
