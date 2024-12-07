import type {
  Helper,
  INITIAL_REVISION,
  InternalComponentManager,
  InternalHelperManager,
  InternalModifierManager,
  Optional,
  Owner,
  ReferenceSymbol,
  Revision,
  Tag,
  TagTypeSymbol,
  UpdatableTag,
} from '@glimmer/interfaces';

import type { DebugTransactionFrame, TrackerState, TransactionEnv } from './lib/types';

const STATE = Symbol.for('@glimmer/state');

let current = Reflect.get(globalThis, STATE) as Optional<State>;

export interface DebugState {
  consumed: WeakMap<Tag, DebugTransactionFrame> | null;
  stack: DebugTransactionFrame[];
  env: TransactionEnv;
  cycleMap: WeakMap<Tag, boolean>;
}

export type TagMeta = Map<PropertyKey, UpdatableTag>;

export interface State {
  readonly TYPE: TagTypeSymbol;
  readonly REFERENCE: ReferenceSymbol;

  readonly meta: WeakMap<object, TagMeta>;
  readonly tracking: TrackerState;
  readonly managers: {
    readonly component: WeakMap<object, InternalComponentManager>;
    readonly modifier: WeakMap<object, InternalModifierManager>;
    readonly helper: WeakMap<object, InternalHelperManager<Owner> | Helper>;
    // TODO: Add custom manager
  };
  readonly clock: {
    now: Revision;
  };
  debug?: DebugState;
}

if (!current) {
  const TYPE: TagTypeSymbol = Symbol('TAG_TYPE') as TagTypeSymbol;
  const REFERENCE: ReferenceSymbol = Symbol('REFERENCE') as ReferenceSymbol;

  current = {
    TYPE,
    REFERENCE,
    meta: new WeakMap(),

    tracking: {
      current: null,
      stack: [],
    },
    managers: {
      component: new WeakMap(),
      modifier: new WeakMap(),
      helper: new WeakMap(),
    },
    clock: {
      now: 1 as INITIAL_REVISION,
    },
  };

  if (import.meta.env.DEV) {
    current.debug = {
      cycleMap: new WeakMap(),
      env: {},
      consumed: null,
      stack: [],
    };
  }

  Reflect.set(globalThis, STATE, current);
}

const state = current;
export default state;
