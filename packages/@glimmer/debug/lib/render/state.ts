import type {
  BlockMetadata,
  DebugVmSnapshot,
  Dict,
  RuntimeConstants,
  RuntimeHeap,
  SnapshotArray,
} from '@glimmer/interfaces';
import { decodeHandle } from '@glimmer/util';

import {
  debug,
  type DebugConstants,
  type OpSnapshot,
  type SomeDisassembledOperand,
} from '../debug';
import type { OpcodeMetadata, StackSpec } from '../metadata';
import { opcodeMetadata } from '../opcode-metadata';
import {
  array,
  describeDiff,
  diffStacks,
  eqStack,
  liveBlock,
  pick,
  scopeValue,
  stackValue,
} from './combinators';
import type { Fragment } from './fragment';
import { as, frag, type IntoFragment, intoFragment, join, value } from './presets';
import { SerializeBlockContext } from './serialize';

const HEADER_SIZE = 2;

export class DebugState {
  readonly #state: DebugVmSnapshot;

  constructor(state: DebugVmSnapshot) {
    this.#state = state;
  }

  target(relative: number): number {
    return this.#state.currentPc + relative;
  }

  derefHandle<T>(handle: number): T {
    return this.constants.getValue<T>(decodeHandle(handle));
  }

  derefArrayHandle<T extends unknown[] = unknown[]>(handle: number): T {
    return this.constants.getArray<T>(decodeHandle(handle));
  }

  get stack(): SnapshotArray<unknown> {
    return this.rawStack;
  }

  get rawStack(): SnapshotArray<unknown> {
    return this.#state.frame.stack;
  }

  get snapshot(): DebugVmSnapshot {
    return this.#state;
  }

  get constants(): DebugConstants {
    return this.#state.constant.constants;
  }

  get heap(): RuntimeHeap {
    return this.#state.constant.heap;
  }

  get dom(): DebugVmSnapshot['dom'] {
    return this.#state.dom;
  }

  get frame(): DebugVmSnapshot['frame'] {
    return this.#state.frame;
  }

  /**
   * The next instruction to be executed
   */
  get nextPc(): number {
    return this.#state.$pc;
  }

  get sp(): number {
    return this.#state.$sp;
  }

  get fp(): number {
    return this.#state.$fp;
  }

  get symbols(): string[] {
    return this.#state.constant.block?.debugSymbols ?? [];
  }

  get registers() {
    return {
      frame: pick(this.#state, ['$pc', '$fp', '$sp', '$ra']),
      saved: pick(this.#state, ['$s0', '$s1']),
      temporaries: pick(this.#state, ['$t0', '$t1']),
      return: this.#state.$v0,
      returnTo: pick(this.#state, ['$v0', '$up']),
    } as const;
  }
}
export class DebugOpState {
  readonly #op: OpSnapshot;
  readonly #debug: { name: string; params: Dict<SomeDisassembledOperand> };
  readonly #metadata: OpcodeMetadata;
  readonly #block: SerializeBlockContext;

  constructor(constants: RuntimeConstants, op: OpSnapshot, block: BlockMetadata | null) {
    this.#op = op;

    const { name, params } = debug(constants, op, block)!;
    this.#debug = { name, params };
    this.#metadata = opcodeMetadata(op.type);
    this.#block = new SerializeBlockContext(block);
  }

  get metadata(): OpcodeMetadata {
    return this.#metadata;
  }

  stack(before: DebugState): StackSpec {
    return this.#metadata.stack(this.#op, before.snapshot);
  }

  expectedStackDelta(before: DebugState): number | undefined {
    return this.stack(before)?.delta;
  }

  /**
   * The current instruction, computed by subtracting the size of the opcode
   * from the next instruction.
   */

  pos(before: DebugState): number {
    return before.nextPc - this.#op.size;
  }

  get name() {
    return this.#debug.name;
  }

  get params() {
    return this.#debug.params;
  }

  get dynamicParams(): Dict<SomeDisassembledOperand> | null {
    const entries = Object.entries(this.#debug.params).filter(
      (entry): entry is [string, SomeDisassembledOperand] => entry[1].isDynamic
    );

    if (entries.length === 0) {
      return null;
    } else {
      return Object.fromEntries(entries);
    }
  }

  describe(): Fragment {
    const { name, params } = this.#debug;

    let args: IntoFragment[] = Object.entries(params).map(
      ([p, v]) => frag`${as.attrName(p)}=${this.#serialize(v)}`
    );
    return frag`(${join([as.kw(name), ...args], ' ')})`;
  }

  #serialize(value: SomeDisassembledOperand) {
    return this.#block.serialize(value);
  }
}
export class DiffState {
  // readonly #prev: DebugState | undefined;
  readonly #before: DebugState | undefined;
  readonly #after: DebugState;

  constructor(prev: DebugState | undefined, before: DebugState | undefined, after: DebugState) {
    // this.#prev = prev;
    this.#before = before;
    this.#after = after;
  }

  #change<T>(compare: (state: DebugVmSnapshot) => T, create: (value: T) => Fragment) {
    if (this.#before === undefined) {
      return create(compare(this.#after.snapshot));
    }

    const prev = compare(this.#before.snapshot);
    const current = compare(this.#after.snapshot);

    if (Object.is(prev, current)) {
      return create(current).subtle().styleAll('subtle');
    } else {
      return create(current);
    }
  }

  change<T>(compare: (state: DebugVmSnapshot) => T, create: (value: T) => Fragment) {
    if (this.#before === undefined) {
      return create(compare(this.#after.snapshot));
    }

    const prev = compare(this.#before.snapshot);
    const current = compare(this.#after.snapshot);

    if (Object.is(prev, current)) {
      return create(prev).subtle().styleAll('subtle');
    } else {
      return create(prev);
    }
  }

  get return(): Fragment {
    return this.#formatState('$v0', { as: value, desc: 'return value' });
  }

  get up(): Fragment {
    return this.#formatState('$up', { as: value });
  }

  get ra(): Fragment {
    return this.#formatState('$ra', { as: intoFragment });
  }

  get saved(): Fragment {
    const s0 = this.#formatState('$s0', { as: value });
    const s1 = this.#formatState('$s1', { as: value });

    return array([s0, s1]);
  }

  get temporaries(): Fragment {
    const t0 = this.#formatState('$t0', { as: value });
    const t1 = this.#formatState('$t1', { as: value });

    return array([t0, t1]);
  }

  get scope(): Fragment {
    const before = this.#before?.snapshot.frame.scope ?? null;
    const after = this.#after?.snapshot.frame.scope ?? null;

    if (eqStack(before, after)) {
      return frag`${as.subtle('(unchanged)')} ${
        Array.isArray(after) ? array(after, { as: scopeValue }) : value(after)
      }`.subtle();
    }

    return after === null ? value(null) : array(after, { as: scopeValue });
  }

  get blocks(): Fragment {
    const before = this.#before?.snapshot.dom.blocks;
    const after = this.#after?.snapshot.dom.blocks;

    if (eqStack(before, after)) {
      return frag`${as.subtle('(unchanged)')} ${array(after, { as: liveBlock })}`.subtle();
    }

    return describeDiff(diffStacks(before ?? [], after ?? []), { as: liveBlock });
  }

  frame(spec: StackSpec): Fragment {
    const before: SnapshotArray<unknown> = this.#before?.stack ?? ([] as const);
    const after: SnapshotArray<unknown> = this.#after?.stack ?? ([] as const);

    if (spec.type === 'delta' || spec.type === 'unchecked') {
      if (eqStack(before, after)) {
        return frag`${as.subtle('(unchanged)')} ${value(before)}`.subtle();
      }

      return describeDiff(diffStacks(before, after), { as: stackValue });
    }

    // from end of before:
    // popped: spec.pop
    // peeked: spec.peek
    // same: rest

    // const popped =

    const { before: beforePopped, after: popped } = partitionFromEnd(before, spec.pop);
    const { before: unused, after: peeked } = partitionFromEnd(beforePopped, spec.peek);
    const pushed = partitionFromEnd(after, spec.push).after;

    // const paramSize = spec.peek + spec.pop;
    // const same = paramSize === 0 ? before : before.slice(0, -paramSize);
    // const peeked = spec.peek === 0 ? [] : before.slice(spec.peek, -spec.pop);
    // const popped = spec.pops === 0 ? [] : before.slice(-spec.pops);
    // const pushed = spec.pushes === 0 ? [] : after.slice(-spec.pushes);

    return describeDiff({ unused, peeked, pushed, popped }, { as: stackValue });
  }

  #formatState<K extends keyof DebugVmSnapshot>(
    key: K,
    {
      as: map,
      desc,
    }: {
      as: (value: DebugVmSnapshot[K]) => IntoFragment;
      desc?: IntoFragment;
    }
  ): Fragment {
    return this.#change(
      (state) => state[key],
      (value) => {
        const description = desc ? frag` (${desc})`.styleAll('comment') : '';
        return frag`${as.kw(key)}${description}: ${map(value)}`;
      }
    );
  }
}

function partitionFromEnd<T>(
  array: readonly T[],
  position: number
): { before: readonly T[]; after: readonly T[] } {
  if (position === 0) {
    return { before: array, after: [] };
  } else {
    return { before: array.slice(0, -position), after: array.slice(-position) };
  }
}
