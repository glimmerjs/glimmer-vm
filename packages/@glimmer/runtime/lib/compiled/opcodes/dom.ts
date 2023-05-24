import {
  check,
  CheckElement,
  CheckMaybe,
  CheckNode,
  CheckOption,
  CheckString,
} from '@glimmer/debug';
import type {
  AttributeRef,
  CapturedArguments,
  CapturedPositionalArguments,
  Destroyable,
  Environment,
  InstallableModifier,
  Maybe,
  MinimalChild,
  MinimalCursor,
  MinimalElement,
  ModifierDefinition,
  ModifierDefinitionState,
  ModifierInstance,
  Nullable,
  Optional,
  Revision,
  Tag,
  UpdatableTag,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import { createComputeRef, isConstRef, type Reference, valueForRef } from '@glimmer/reference';
import { debugToString, expect, isObject, unwrap } from '@glimmer/util';
import {
  createCache,
  type TrackedCache,
  consumeTag,
  validateTag,
  getTaggedValue,
  now,
  createUpdatableTag,
  updateTag,
  beginTrackFrame,
  endTrackFrame,
} from '@glimmer/validator';
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
import { updateAttributeRef } from '../../dom/tree-builder';
import { associateDestroyableChild, destroy } from '@glimmer/destroyable';
import type { UpdatingVM } from '../../vm';

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

  // let modifiers: Nullable<ReferenceModifierInstance[]> = null;

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
      return {};
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
  });

  let operations = expect(
    check(vm._fetchValue_($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  let modifier = operations.addModifier(cache, args);
  consumeTag(modifier.tag);

  return vm._updateWith_(modifier);
});

export interface ModifierInstanceRef {
  current: ModifierInstance | undefined;
}

type DefinitionCache = TrackedCache<LastDefinition>;

interface LastDefinition {
  definition?: ModifierDefinition | undefined;
  owner: object;
  element: Element;
  args: CapturedArguments;
}

export class UpdateModifierOpcode implements UpdatingOpcode, InstallableModifier {
  readonly #cache: DefinitionCache;
  #lastUpdated: number;
  #lastTag: Optional<Tag>;
  #lastDestroyable: Nullable<Destroyable> = null;
  #lastDefinition: Optional<[LastDefinition, Tag]>;
  #lastInstance: Optional<ModifierInstance>;
  #tag: UpdatableTag;

  constructor(cache: DefinitionCache) {
    this.#lastUpdated = now();
    this.#cache = cache;
    this.#tag = createUpdatableTag();
  }

  get element() {
    let [{ element }] = this.#initialized;
    return element;
  }

  get tag() {
    return this.#tag;
  }

  get #initialized() {
    if (this.#lastTag && validateTag(this.#lastTag, this.#lastUpdated)) {
      return this.#lastDefinition;
    }

    let [definitionValue, definitionTag] = getTaggedValue(this.#cache);

    return (this.#lastDefinition = [definitionValue, definitionTag]);
  }

  destroy(): void {
    console.log('destroying');
    destroy(this);
  }

  render() {
    let [definitionValue, definitionTag] = this.#initialized;

    if (!definitionValue) {
      updateTag(this.#tag, definitionTag);
      return;
    }

    let { definition, owner, element, args } = definitionValue;

    if (!definition) {
      updateTag(this.#tag, definitionTag);
      return;
    }

    let manager = definition.manager;

    beginTrackFrame();

    try {
      consumeTag(definitionTag);
      let state = manager.create(owner, element, definition.state, args);
      let managerTag = manager.getTag(state);
      if (managerTag) consumeTag(managerTag);
      manager.install(state);
      let destroyable = manager.getDestroyable(state);
      if (destroyable) {
        associateDestroyableChild(this, destroyable);
        this.#lastDestroyable = destroyable;
      }
      this.#lastInstance = {
        manager,
        state,
        definition,
      };
    } finally {
      let userTag = endTrackFrame();
      updateTag(this.#tag, userTag);
    }

    this.#lastUpdated = now();

    // let [instance, tag] = getTaggedValue(this.#cache);
    // this.#lastInstance = instance;
    // this.#lastTag = tag;
    // this.#lastUpdated = current();

    // if (!instance) return;

    // let { manager, definition, state } = instance;
    // let modifierTag = manager.getTag(state);
    // updateTag(this.#tag, modifierTag ?? CONSTANT_TAG);

    // if (modifierTag) {
    //   let tag = track(
    //     () => manager.install(state),
    //     import.meta.env.DEV &&
    //       `- While rendering:\n  (instance of a \`${
    //         definition.resolvedName || manager.getDebugName(definition.state)
    //       }\` modifier)`
    //   );
    //   updateTag(modifierTag, tag);
    // } else {
    //   manager.install(state);
    // }

    // let d = manager.getDestroyable(state);
    // if (d) {
    //   associateDestroyableChild(this, d);
    //   this.#lastDestroyable = d;
    // }
  }

  #cleanup() {
    if (this.#lastDestroyable) {
      destroy(this.#lastDestroyable);
      this.#lastDestroyable = null;
    }
  }

  update() {
    // let [{ definition: newDefinition, owner, element, args }, definitionTag] = getTaggedValue(
    //   this.#cache
    // );
    // let [{ definition: lastDefinition }, lastDefinitionTag] = unwrap(this.#lastDefinition);

    let [, lastDefinitionTag] = unwrap(this.#lastDefinition);

    if (!validateTag(lastDefinitionTag, this.#lastUpdated)) {
      this.#cleanup();
      this.render();
      this.#lastUpdated = now();
      return;
      // throw new Error(`unimplemented: regenerating definition`);
    }

    let { state, manager } = unwrap(this.#lastInstance);

    if (!validateTag(this.#tag, this.#lastUpdated)) {
      manager.update(state);
      this.#lastUpdated = now();
    }

    // if (lastDefinition !== newDefinition) {
    //   debugger;
    //   this.#cleanup();
    // }

    // this.#lastInstance = instance;
    // this.#lastTag = tag;
    // this.#lastUpdated = current();
    // if (!instance) {
    //   if (this.#lastDestroyable) destroy(this.#lastDestroyable);
    //   this.#lastDestroyable = undefined;
    //   return;
    // }
    // if (instance !== this.#lastInstance) {
    //   throw new Error(`unimplemented: teardown`);
    // }
    // let { manager, definition, state } = instance;
    // let modifierTag = manager.getTag(state);
    // updateTag(this.#tag, modifierTag ?? CONSTANT_TAG);
    // if (modifierTag) {
    //   let tag = track(
    //     () => manager.update(state),
    //     import.meta.env.DEV &&
    //       `- While rendering:\n  (instance of a \`${
    //         definition.resolvedName || manager.getDebugName(definition.state)
    //       }\` modifier)`
    //   );
    //   updateTag(modifierTag, tag);
    // } else {
    //   manager.update(state);
    // }
    // let d = manager.getDestroyable(state);
    // if (d) associateDestroyableChild(this, d);
  }

  // destroy() {}

  evaluate(vm: UpdatingVM) {
    consumeTag(this.#tag);
    console.log({ evaluate: this });
    // let next;
    let isValid = this.#lastTag ? validateTag(this.#lastTag, this.#lastUpdated) : false;

    if (isValid) return;

    vm.env.scheduleUpdateModifier(this);

    // let lastTag = track(() => (next = getValue(this.#cache)));
    // console.log({ update: valueForTag(this.#opcodeTag), lastTag: valueForTag(lastTag) });
    // console.log(valueForTag(lastTag), current());
    // debugger;
    // let isOpcodeValid = validateTag(this.#opcodeTag, this.#lastUpdated);
    // let isCacheValid =
    //   this.#lastCacheTag !== undefined && validateTag(this.#lastCacheTag, this.#lastUpdated);
    // if (isOpcodeValid && isCacheValid) {
    //   return;
    // }
    // let next;
    // this.#lastCacheTag = track(() => (next = getValue(this.#cache)));
    // this.#lastUpdated = valueForTag(this.#opcodeTag);
    // if (next) vm.env.scheduleUpdateModifier(next);
    // validate(this.#opcodeTag, this.#lastUpdated, (revision) => {
    //   this.#lastUpdated = revision;
    //   let next = getValue(this.#cache);
    //   if (next) vm.env.scheduleUpdateModifier(next);
    // });
  }
}

function validate<T>(
  tag: Tag,
  lastUpdated: Revision,
  ifInvalid: (revision: Revision) => T,
  ifValid?: () => T
): T | undefined {
  consumeTag(tag);

  return validateTag(tag, lastUpdated) ? ifValid?.() : ifInvalid(lastUpdated);
}

// export class UpdateDynamicModifierOpcode implements UpdatingOpcode {
//   #lastUpdated: Revision;
//   #tag: Tag | null;
//   #instance: Reference<ModifierInstance>;
//   #last: ModifierInstance | undefined;

//   constructor(
//     tag: Tag | null,
//     element: Element,
//     owner: object,
//     instance: Reference<ModifierInstance>
//   ) {
//     this.#tag = tag;
//     this.#instance = instance;
//     this.#lastUpdated = valueForTag(tag ?? CURRENT_TAG);
//   }

//   evaluate(vm: UpdatingVM) {
//     let tag = this.#tag;
//     let lastUpdated = this.#lastUpdated;
//     let instance = valueForRef(this.#instance);

//     let newInstance = valueForRef(instanceReference);

//     if (newInstance !== instance) {
//       if (instance !== undefined) {
//         let destroyable = instance.manager.getDestroyable(instance.state);

//         if (destroyable !== null) {
//           destroy(destroyable);
//         }
//       }

//       if (newInstance !== undefined) {
//         let { manager, state } = newInstance;
//         let destroyable = manager.getDestroyable(state);

//         if (destroyable !== null) {
//           associateDestroyableChild(this, destroyable);
//         }

//         tag = manager.getTag(state);

//         if (tag !== null) {
//           this.#lastUpdated = valueForTag(tag);
//         }

//         this.#tag = tag;
//         vm.env.scheduleInstallModifier(newInstance);
//       }

//       this.#instance.current = newInstance;
//     } else if (tag !== null && !validateTag(tag, lastUpdated)) {
//       vm.env.scheduleUpdateModifier(instance);
//       this.#lastUpdated = valueForTag(tag);
//     }

//     if (tag !== null) {
//       consumeTag(tag);
//     }
//   }
// }

define(STATIC_ATTR_OP, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  vm._elements_().addAttr(name, value);
});

define(DYNAMIC_ATTR_OP, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = check(vm.stack.pop(), CheckReference);
  let value = valueForRef(reference);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  let attribute = vm._elements_().addAttr(name, value);

  if (!isConstRef(reference)) {
    vm._updateWith_(new UpdateDynamicAttributeOpcode(reference, attribute, vm.env));
  }
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  readonly #updateRef: Reference;

  constructor(reference: Reference<unknown>, attribute: AttributeRef, environment: Environment) {
    let initialized = false;

    this.#updateRef = createComputeRef(() => {
      let value = valueForRef(reference);

      if (initialized === true) {
        updateAttributeRef(attribute, value);
        // attribute.update(value, environment);
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
