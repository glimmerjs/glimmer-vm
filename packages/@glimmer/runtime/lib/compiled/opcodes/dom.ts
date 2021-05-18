import { createCache, getDebugLabel, getValue, isConst } from '@glimmer/validator';
import {
  check,
  CheckString,
  CheckElement,
  CheckOption,
  CheckNode,
  CheckMaybe,
} from '@glimmer/debug';
import {
  Op,
  Option,
  ModifierDefinition,
  ModifierInstance,
  Owner,
  CapturedPositionalArguments,
  CurriedType,
  ModifierDefinitionState,
  Environment,
  UpdatingOpcode,
  EffectPhase,
  Source,
} from '@glimmer/interfaces';
import { $t0 } from '@glimmer/vm';
import { APPEND_OPCODES } from '../../opcodes';
import { Assert } from './vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { CheckSource, CheckArguments, CheckOperations } from './-debug-strip';
import { CONSTANTS } from '../../symbols';
import { assign, debugToString, expect, isObject } from '@glimmer/util';
import { CurriedValue, isCurriedType, resolveCurriedValue } from '../../curried-value';
import { DEBUG } from '@glimmer/env';
import { associateDestroyableChild, destroy, isDestroying } from '@glimmer/destroyable';

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
  let tagName = check(getValue(check(vm.stack.pop(), CheckSource)), CheckString);
  vm.elements().openElement(tagName);
});

APPEND_OPCODES.add(Op.PushRemoteElement, (vm) => {
  let elementSource = check(vm.stack.pop(), CheckSource);
  let insertBeforeSource = check(vm.stack.pop(), CheckSource);
  let guidSource = check(vm.stack.pop(), CheckSource);

  let element = check(getValue(elementSource), CheckElement);
  let insertBefore = check(getValue(insertBeforeSource), CheckMaybe(CheckOption(CheckNode)));
  let guid = getValue(guidSource) as string;

  if (!isConst(elementSource)) {
    vm.updateWith(new Assert(elementSource));
  }

  if (insertBefore !== undefined && !isConst(insertBeforeSource)) {
    vm.updateWith(new Assert(insertBeforeSource));
  }

  let block = vm.elements().pushRemoteElement(element, guid, insertBefore);
  if (block) vm.associateDestroyable(block);
});

APPEND_OPCODES.add(Op.PopRemoteElement, (vm) => {
  vm.elements().popRemoteElement();
});

APPEND_OPCODES.add(Op.FlushElement, (vm) => {
  let operations = check(vm.fetchValue($t0), CheckOperations);
  let modifiers: Option<Source[]> = null;

  if (operations) {
    modifiers = operations.flush(vm);
    vm.loadValue($t0, null);
  }

  vm.elements().flushElement(modifiers);
});

APPEND_OPCODES.add(Op.CloseElement, (vm) => {
  let modifiers = vm.elements().closeElement();

  if (modifiers) {
    modifiers.forEach((modifier) => {
      vm.env.registerEffect(EffectPhase.Layout, modifier);
      vm.associateDestroyable(modifier);
    });
  }
});

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let owner = vm.getOwner();
  let args = check(vm.stack.pop(), CheckArguments);
  let definition = vm[CONSTANTS].getValue<ModifierDefinition>(handle);

  let { manager } = definition;

  let { constructing } = vm.elements();

  let state = manager.create(
    owner,
    expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
    definition.state,
    args.capture()
  );

  let operations = expect(
    check(vm.fetchValue($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  let didSetup = false;

  let cache = createCache(() => {
    if (isDestroying(cache)) return;

    if (didSetup === false) {
      didSetup = true;

      manager.install(state);
    } else {
      manager.update(state);
    }
  }, DEBUG && `- While rendering:\n  (instance of a \`${definition.resolvedName || manager.getDebugName(definition.state)}\` modifier)`);

  let d = manager.getDestroyable(state);

  if (d) {
    associateDestroyableChild(cache, d);
  }

  operations.addModifier(cache);
});

APPEND_OPCODES.add(Op.DynamicModifier, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack, [CONSTANTS]: constants } = vm;
  let ref = check(stack.pop(), CheckSource);
  let args = check(stack.pop(), CheckArguments).capture();
  let { constructing } = vm.elements();
  let initialOwner = vm.getOwner();

  let instanceCache = createCache(() => {
    let value = getValue(ref);
    let owner: Owner;

    if (!isObject(value)) {
      return;
    }

    let hostDefinition: CurriedValue | ModifierDefinitionState;

    if (isCurriedType(value, CurriedType.Modifier)) {
      let {
        definition: resolvedDefinition,
        owner: curriedOwner,
        positional,
        named,
      } = resolveCurriedValue(value);

      hostDefinition = resolvedDefinition;
      owner = curriedOwner;

      if (positional !== undefined) {
        args.positional = positional.concat(args.positional) as CapturedPositionalArguments;
      }

      if (named !== undefined) {
        args.named = assign({}, ...named, args.named);
      }
    } else {
      hostDefinition = value;
      owner = initialOwner;
    }

    let handle = constants.modifier(hostDefinition, null, true);

    if (DEBUG && handle === null) {
      throw new Error(
        `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${getDebugLabel(
          ref
        )}}}\`, and the incorrect definition is the value at the path \`${getDebugLabel(
          ref
        )}\`, which was: ${debugToString!(hostDefinition)}`
      );
    }

    let definition = constants.getValue<ModifierDefinition>(
      expect(handle, 'BUG: modifier handle expected')
    );

    let { manager } = definition;

    let state = manager.create(
      owner,
      expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
      definition.state,
      args
    );

    return {
      manager,
      state,
      definition,
    };
  });

  let instance: ModifierInstance | undefined;

  let cache = createCache(() => {
    if (isDestroying(cache)) return;

    let newInstance = getValue(instanceCache);

    if (instance !== newInstance) {
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
          associateDestroyableChild(cache, destroyable);
        }

        manager.install(newInstance.state);
      }

      instance = newInstance;
    } else if (instance !== undefined) {
      instance.manager.update(instance.state);
    }
  }, DEBUG && `- While rendering:\n  (instance of a dynamic modifier)`);

  let operations = expect(
    check(vm.fetchValue($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  operations.addModifier(cache);
});

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let source = check(vm.stack.pop(), CheckSource);
  let value = getValue(source);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  let attribute = vm.elements().setDynamicAttribute(name, value, trusting, namespace);

  if (!isConst(source)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(source, attribute, vm.env));
  }
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  private updateSource: Source;

  constructor(reference: Source, attribute: DynamicAttribute, env: Environment) {
    let initialized = false;

    this.updateSource = createCache(() => {
      let value = getValue(reference);

      if (initialized === true) {
        attribute.update(value, env);
      } else {
        initialized = true;
      }
    });

    getValue(this.updateSource);
  }

  evaluate() {
    getValue(this.updateSource);
  }
}
