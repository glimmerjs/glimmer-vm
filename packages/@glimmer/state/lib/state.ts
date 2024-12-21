import type { OwnerSymbol } from './types';
import type {
  CapabilitiesSymbol,
  Helper,
  InternalComponentManager,
  InternalHelperManager,
  InternalModifierManager,
  Owner,
} from './types/manager';
import type { ReferenceSymbol } from './types/reference';
import type { InitialRevision, Revision, Tag, TagMeta, TagTypeSymbol } from './types/tag';
import type {
  DebugTransactionFrame,
  Destroyable,
  DestroyableMeta,
  TrackerState,
  TransactionEnv,
} from './types/types';

/**
 * The `STATE` symbol coordinates all of the fundamental state
 * required by the rest of the Glimmer runtime under a single
 * symbol. The first time this code is executed, it sets up the
 * the state under this symbol. All subsequent executions of this
 * code (however duplicated) will use the same state.
 */
const STATE = Symbol.for('@glimmer/state');

let current = Reflect.get(globalThis, STATE) as State | undefined;

export interface DebugState {
  consumed: WeakMap<Tag, DebugTransactionFrame> | null;
  stack: DebugTransactionFrame[];
  env: TransactionEnv;
  cycleMap: WeakMap<Tag, boolean>;
}

export interface State {
  readonly TYPE: TagTypeSymbol;
  readonly REFERENCE: ReferenceSymbol;
  readonly OWNER: OwnerSymbol;
  readonly CAPABILITIES: CapabilitiesSymbol;

  readonly meta: WeakMap<object, TagMeta>;
  destroyables: {
    current:
      | Map<Destroyable, DestroyableMeta<Destroyable>>
      | WeakMap<Destroyable, DestroyableMeta<Destroyable>>;
  };

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
  const OWNER: OwnerSymbol = Symbol('OWNER') as OwnerSymbol;
  const CAPABILITIES: CapabilitiesSymbol = Symbol('CAPABILITIES') as CapabilitiesSymbol;

  current = {
    TYPE,
    REFERENCE,
    OWNER,
    CAPABILITIES,
    meta: new WeakMap(),
    destroyables: { current: new WeakMap() },
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
      now: 1 as InitialRevision,
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

export const state: State = current;
export const destroyables: typeof state.destroyables = state.destroyables;
export const clock: typeof state.clock = state.clock;
export const debug: typeof state.debug = state.debug;
export const tracking: typeof state.tracking = state.tracking;
export const meta: typeof state.meta = state.meta;
export const managers: typeof state.managers = state.managers;
export const REFERENCE: typeof state.REFERENCE = state.REFERENCE;
export const OWNER: typeof state.OWNER = state.OWNER;
export const CAPABILITIES: typeof state.CAPABILITIES = state.CAPABILITIES;
