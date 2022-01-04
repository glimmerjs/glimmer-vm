import { _WeakSet } from '@glimmer/util';
import { ComponentManager, HelperManager, ModifierManager, Owner } from '@glimmer/interfaces';
import {
  setInternalComponentManager,
  setInternalHelperManager,
  setInternalModifierManager,
} from '../internal/index';
import { CustomComponentManager } from './component';
import { CustomModifierManager } from './modifier';
import { CustomHelperManager } from './helper';

type Manager = ComponentManager<unknown> | ModifierManager<unknown> | HelperManager<unknown>;

export type ManagerFactory<O, D extends Manager = Manager> = (owner: O) => D;

/**
  Associate a class with a component manager (an object that is responsible for
  coordinating the lifecycle events that occurs when invoking, rendering and
  re-rendering a component).

  @method setComponentManager
  @param {Function} factory a function to create the owner for an object
  @param {Object} obj the object to associate with the componetn manager
  @return {Object} the same object passed in
  @public
 */
export function setComponentManager<O extends Owner, T extends object>(
  factory: ManagerFactory<O, ComponentManager<unknown>>,
  obj: T
): T {
  return setInternalComponentManager(new CustomComponentManager(factory), obj);
}

export function setModifierManager<O extends Owner, T extends object>(
  factory: ManagerFactory<O, ModifierManager<unknown>>,
  obj: T
): T {
  return setInternalModifierManager(new CustomModifierManager(factory), obj);
}

export function setHelperManager<O extends Owner, T extends object>(
  factory: ManagerFactory<O | undefined, HelperManager<unknown>>,
  obj: T
): T {
  return setInternalHelperManager(new CustomHelperManager(factory), obj);
}
