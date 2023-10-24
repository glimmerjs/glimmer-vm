import type { DebugConstants } from '@glimmer/debug';
import type {
  LiveBlockDebug,
  Nullable,
  ScopeSlot,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';

export interface DebugVmState {
  pc: number;
  sp: number;
  ra: number;
  fp: number;
  up: number;
  s0: unknown;
  s1: unknown;
  t0: unknown;
  t1: unknown;
  v0: unknown;
  scope: ScopeSlot[] | null;
  constructing: SimpleElement | null;

  stacks: {
    eval: { before: unknown[]; frame: unknown[] };
    inserting: DebugCursor[];
    blocks: LiveBlockDebug[];
    destroyable: object[];
  };
  constants: DebugConstants;
}
export interface ReadonlyStack {
  get<T = number>(position: number, base?: number): T;
  top<T>(offset?: number): T;
}

export interface CleanStack extends ReadonlyStack {
  push(...values: unknown[]): void;
  pop<T>(count?: number): T;
  dup(position?: number): void;
}

export interface InternalStack extends CleanStack {
  reset(): void;
}

export interface DebugStack extends InternalStack {
  frame(): unknown[];
  all(): { before: unknown[]; frame: unknown[] };
}
export interface DebugCursor {
  readonly parent: SimpleElement;
  readonly next?: Nullable<SimpleNode>;
}
