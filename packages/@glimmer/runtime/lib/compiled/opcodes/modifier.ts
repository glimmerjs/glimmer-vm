import type {
  CapturedArguments,
  Destroyable,
  InstallableModifier,
  ModifierDefinition,
  ModifierInstance,
  Nullable,
  Optional,
  Tag,
  UpdatableTag,
  UpdatingOpcode,
} from '@glimmer/interfaces';

import { unwrap } from '@glimmer/util';
import {
  consumeTag,
  validateTag,
  getTaggedValue,
  now,
  createUpdatableTag,
  updateTag,
  beginTrackFrame,
  endTrackFrame,
  type TrackedCache,
  combine,
} from '@glimmer/validator';

import { associateDestroyableChild, destroy } from '@glimmer/destroyable';
import type { UpdatingVM } from '../../vm';

export class UpdateModifierOpcode implements UpdatingOpcode, InstallableModifier {
  readonly #cache: DefinitionCache;
  #lastUpdated: number;
  #lastTag: Optional<Tag>;
  readonly #installTag: UpdatableTag;
  readonly #definitionTag: UpdatableTag;
  readonly #userTag: UpdatableTag;
  #lastDestroyable: Nullable<Destroyable> = null;
  #lastDefinition: Optional<[LastDefinition, Tag]>;
  #lastInstance: Optional<ModifierInstance>;
  readonly #tag: Tag;
  #lastArgs: CapturedArguments | null = null;

  constructor(cache: DefinitionCache) {
    this.#lastUpdated = now();
    this.#cache = cache;
    this.#installTag = createUpdatableTag(`UpdateModifierOpcode::install`);
    this.#definitionTag = createUpdatableTag(`UpdateModifierOpcode::definition`);
    this.#userTag = createUpdatableTag(`UpdateModifierOpcode::userspace`);
    this.#tag = combine(
      [this.#installTag, this.#definitionTag, this.#userTag],
      `UpdateModifierOpcode`
    );
  }

  get element() {
    let [{ element }] = unwrap(this.#initialized);
    return element;
  }

  get tag() {
    return this.#tag;
  }

  get #initialized(): Optional<[LastDefinition, Tag]> {
    if (this.#lastTag && validateTag(this.#lastTag, this.#lastUpdated)) {
      return this.#lastDefinition;
    }

    let [definitionValue, definitionTag] = getTaggedValue(this.#cache);
    updateTag(this.#definitionTag, definitionTag);

    return (this.#lastDefinition = [definitionValue, definitionTag]);
  }

  destroy(): void {
    destroy(this);
  }

  render() {
    let [definitionValue, definitionTag] = unwrap(this.#initialized);
    updateTag(this.#definitionTag, definitionTag);

    if (!definitionValue) {
      return;
    }

    let { definition, owner, element, args } = definitionValue;
    this.#lastArgs ??= args;

    if (!definition) {
      return;
    }

    let manager = definition.manager;

    beginTrackFrame('ModifierOp::render');

    try {
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
      updateTag(this.#installTag, userTag);
    }

    consumeTag(this.#tag);
    this.#lastUpdated = now();
  }

  #cleanup() {
    if (this.#lastDestroyable) {
      destroy(this.#lastDestroyable);
      this.#lastDestroyable = null;
    }
  }

  update() {
    let [, lastDefinitionTag] = unwrap(this.#lastDefinition);

    if (!validateTag(lastDefinitionTag, this.#lastUpdated)) {
      this.#cleanup();
      this.render();
      this.#lastUpdated = now();
      return;
    }

    let { state, manager } = unwrap(this.#lastInstance);

    if (!validateTag(this.#tag, this.#lastUpdated)) {
      try {
        beginTrackFrame('update modifier');
        manager.update(state);
      } finally {
        let userTag = endTrackFrame();
        updateTag(this.#userTag, userTag);
        this.#lastUpdated = now();
      }
    }
  }

  evaluate(vm: UpdatingVM) {
    consumeTag(this.#tag);
    let isValid = this.#lastTag ? validateTag(this.#lastTag, this.#lastUpdated) : false;

    if (isValid) return;

    vm.env.scheduleUpdateModifier(this);
  }
}

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
