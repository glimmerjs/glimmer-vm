import { DEBUG } from '@glimmer/local-debug-flags';
import { dict, Dict } from "@glimmer/util";

import { Tag, DirtyableTag, TagWrapper, combine, CONSTANT_TAG } from './validators';

/**
 * @decorator
 *
 * Marks a property as tracked.
 *
 * By default, a component's properties are expected to be static,
 * meaning you are not able to update them and have the template update accordingly.
 * Marking a property as tracked means that when that property changes,
 * a rerender of the component is scheduled so the template is kept up to date.
 *
 * @param dependencies Optional dependents to be tracked.
 */
export function tracked(...dependencies: string[]): MethodDecorator;
export function tracked(target: any, key: any): any;
export function tracked(target: any, key: any, descriptor: PropertyDescriptor): PropertyDescriptor;
export function tracked(...dependencies: any[]): any {
  let [target, key, descriptor] = dependencies;

  if (typeof target === "string") {
    return function(target: any, key: string | Symbol, descriptor: PropertyDescriptor) {
      return descriptorForTrackedComputedProperty(target, key, descriptor, dependencies);
    };
  } else {
    if (descriptor) {
      return descriptorForTrackedComputedProperty(target, key, descriptor, []);
    } else {
      installTrackedProperty(target, key);
    }
  }
}

function descriptorForTrackedComputedProperty(target: any, key: any, descriptor: PropertyDescriptor, dependencies: string[]): PropertyDescriptor {
  let meta = metaFor(target);
  meta.trackedProperties[key] = true;
  meta.trackedPropertyDependencies[key] = dependencies || [];

  return {
    enumerable: true,
    configurable: false,
    get: descriptor.get,
    set: function() {
      metaFor(this).dirtyableTagFor(key).inner.dirty();
      descriptor.set!.apply(this, arguments);
      propertyDidChange();
    }
  };
}

export type Key = string;

// In environments that support symbols, we use those to stash the real value of
// the tracked property on the object. Otherwise, we generate a key that is
// unlikely to collide.
let shadowKeyFor: (key: string) => string | symbol;

if (typeof Symbol === 'function') {
  shadowKeyFor = function(key: string) {
    return Symbol(key);
  };
} else {
  let suffix = ' [8c7ff22e-55c5-489f-bfd1-19165c414bf6]';
  shadowKeyFor = function(key: string) {
    return `_${key} ${suffix}`;
  };
}

/**
  Installs a getter/setter for change tracking. The accessor
  acts just like a normal property, but it triggers the `propertyDidChange`
  hook when written to.

  Values are saved on the object using a "shadow key," or a symbol based on the
  tracked property name. Sets write the value to the shadow key, and gets read
  from it.
 */
function installTrackedProperty(target: any, key: Key) {
  let value: any;
  let shadowKey = shadowKeyFor(key);

  let meta = metaFor(target);
  meta.trackedProperties[key] = true;

  if (target[key] !== undefined) {
    value = target[key];
  }

  Object.defineProperty(target, key, {
    configurable: true,

    get() {
      return this[shadowKey];
    },

    set(newValue) {
      metaFor(this).dirtyableTagFor(key).inner.dirty();
      this[shadowKey] = newValue;
      propertyDidChange();
    }
  });
}

/**
 * Stores bookkeeping information about tracked properties on the target object
 * and includes helper methods for manipulating and retrieving that data.
 *
 * Computed properties (i.e., tracked getters/setters) deserve some explanation.
 * A computed property is invalidated when either it is set, or one of its
 * dependencies is invalidated. Therefore, we store two tags for each computed
 * property:
 *
 * 1. The dirtyable tag that we invalidate when the setter is invoked.
 * 2. A union tag (tag combinator) of the dirtyable tag and all of the computed
 *    property's dependencies' tags, used by Glimmer to determine "does this
 *    computed property need to be recomputed?"
 */
export default class Meta {
  tags: Dict<Tag>;
  computedPropertyTags: Dict<TagWrapper<DirtyableTag>>;
  trackedProperties: Dict<boolean>;
  trackedPropertyDependencies: Dict<string[]>;

  constructor(parent: Meta) {
    this.tags = dict<Tag>();
    this.computedPropertyTags = dict<TagWrapper<DirtyableTag>>();
    this.trackedProperties = parent ? Object.create(parent.trackedProperties) : dict<boolean>();
    this.trackedPropertyDependencies = parent ? Object.create(parent.trackedPropertyDependencies) : dict<string[]>();
  }

  /**
   * The tag representing whether the given property should be recomputed. Used
   * by e.g. Glimmer VM to detect when a property should be re-rendered. Think
   * of this as the "public-facing" tag.
   *
   * For static tracked properties, this is a single DirtyableTag. For computed
   * properties, it is a combinator of the property's DirtyableTag as well as
   * all of its dependencies' tags.
   */
  tagFor(key: Key): Tag {
    let tag = this.tags[key];
    if (tag) { return tag; }

    let dependencies;
    if (dependencies = this.trackedPropertyDependencies[key]) {
      return this.tags[key] = combinatorForComputedProperties(this, key, dependencies);
    }

    return this.tags[key] = DirtyableTag.create();
  }

  /**
   * The tag used internally to invalidate when a tracked property is set. For
   * static properties, this is the same DirtyableTag returned from `tagFor`.
   * For computed properties, it is the DirtyableTag used as one of the tags in
   * the tag combinator of the CP and its dependencies.
  */
  dirtyableTagFor(key: Key): TagWrapper<DirtyableTag> {
    let dependencies = this.trackedPropertyDependencies[key];
    let tag;

    if (dependencies) {
      // The key is for a computed property.
      tag = this.computedPropertyTags[key];
      if (tag) { return tag; }
      return this.computedPropertyTags[key] = DirtyableTag.create();
    } else {
      // The key is for a static property.
      tag = this.tags[key];
      if (tag) { return tag as TagWrapper<DirtyableTag>; }
      return this.tags[key] = DirtyableTag.create();
    }
  }
}

function combinatorForComputedProperties(meta: Meta, key: Key, dependencies: Key[] | void): Tag {
  // Start off with the tag for the CP's own dirty state.
  let tags: Tag[] = [meta.dirtyableTagFor(key)];

  // Next, add in all of the tags for its dependencies.
  if (dependencies && dependencies.length) {
    for (let i = 0; i < dependencies.length; i++) {
      tags.push(meta.tagFor(dependencies[i]));
    }
  }

  // Return a combinator across the CP's tags and its dependencies' tags.
  return combine(tags);
}

export interface Interceptors {
  [key: string]: boolean;
}

let META = typeof Symbol === 'function' ? Symbol('meta') : 'meta a13eb73c-dc39-46f0-8939-6df692aa8698';

export function metaFor(obj: any): Meta {
  let meta = obj[META];
  if (meta && hasOwnProperty(obj, META)) {
    return meta;
  }

  return obj[META] = new Meta(meta);
}

let hOP = Object.prototype.hasOwnProperty;
function hasOwnProperty(obj: any, key: symbol | string) {
  return hOP.call(obj, key);
}

let propertyDidChange = function() {};

export function setPropertyDidChange(cb: () => void) {
  propertyDidChange = cb;
}

export function hasTag(obj: any, key: string): boolean {
  let meta = obj[META] as Meta;

  if (!obj[META]) { return false; }
  if (!meta.trackedProperties[key]) { return false; }

  return true;
}

export class UntrackedPropertyError extends Error {
  static for(obj: any, key: string): UntrackedPropertyError {
    return new UntrackedPropertyError(obj, key, `The property '${key}' on ${obj} was changed after being rendered. If you want to change a property used in a template after the component has rendered, mark the property as a tracked property with the @tracked decorator.`);
  }

  constructor(public target: any, public key: string, message: string) {
    super(message);
  }
}

/**
 * Function that can be used in development mode to generate more meaningful
 * error messages.
 */
export interface UntrackedPropertyErrorThrower {
  (obj: any, key: string): void;
}

function defaultErrorThrower(obj: any, key: string): UntrackedPropertyError {
  throw UntrackedPropertyError.for(obj, key);
}

export function tagForProperty(obj: any, key: string, throwError: UntrackedPropertyErrorThrower = defaultErrorThrower): Tag {
  if (typeof obj === "object" && obj) {
    if (DEBUG && !hasTag(obj, key)) {
      installDevModeErrorInterceptor(obj, key, throwError);
    }

    let meta = metaFor(obj);
    return meta.tagFor(key);
  } else {
    return CONSTANT_TAG;
  }
}

/**
 * In development mode only, we install an ad hoc setter on properties where a
 * tag is requested (i.e., it was used in a template) without being tracked. In
 * cases where the property is set, we raise an error.
 */
function installDevModeErrorInterceptor(obj: object, key: string, throwError: UntrackedPropertyErrorThrower) {
  let target = obj;
  let descriptor: PropertyDescriptor;

  // Find the descriptor for the current property. We may need to walk the
  // prototype chain to do so. If the property is undefined, we may never get a
  // descriptor here.
  let hasOwnDescriptor = true;
  do {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor) { break; }
    hasOwnDescriptor = false;
    target = Object.getPrototypeOf(target);
  } while (target);

  // If possible, define a property descriptor that passes through the current
  // value on reads but throws an exception on writes.
  if (descriptor) {
    if (descriptor.configurable || !hasOwnDescriptor) {
      Object.defineProperty(obj, key, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,

        get() {
          if (descriptor.get) {
            return descriptor.get.call(this);
          } else {
            return descriptor.value;
          }
        },

        set() {
          throwError(this, key);
        }
      });
    }
  } else {
    Object.defineProperty(obj, key, {
      set() {
        throwError(this, key);
      }
    });
  }
}
