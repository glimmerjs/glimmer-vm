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
  destroyables:
    | Map<Destroyable, DestroyableMeta<Destroyable>>
    | WeakMap<Destroyable, DestroyableMeta<Destroyable>>;

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
    destroyables: new WeakMap(),
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
