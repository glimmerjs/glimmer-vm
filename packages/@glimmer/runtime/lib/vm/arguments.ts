import { check, CheckBlockSymbolTable, CheckHandle, CheckOption, CheckOr } from '@glimmer/debug';
import type {
  BlockArguments,
  BlockSymbolTable,
  BlockValue,
  CapturedArguments,
  CapturedBlockArguments,
  CapturedNamedArguments,
  CapturedPositionalArguments,
  CompilableBlock,
  Dict,
  NamedArguments,
  Nullable,
  PositionalArguments,
  Scope,
  ScopeBlock,
  VMArguments,
} from '@glimmer/interfaces';
import {
  createDebugAliasRef,
  type Reference,
  UNDEFINED_REFERENCE,
  valueForRef,
} from '@glimmer/reference';
import { dict, EMPTY_STRING_ARRAY, emptyArray, enumerate, unwrap } from '@glimmer/util';
import { CONSTANT_TAG, type Tag } from '@glimmer/validator';
import { $sp } from '@glimmer/vm-constants';

import { CheckCompilableBlock, CheckReference, CheckScope } from '../compiled/opcodes/-debug-strip';
import type { EvaluationStack } from './stack';

/*
  The calling convention is:

  * 0-N block arguments at the bottom
  * 0-N positional arguments next (left-to-right)
  * 0-N named arguments next
*/

export class VMArgumentsImpl implements VMArguments {
  #stack: Nullable<EvaluationStack> = null;
  public positional = new PositionalArgumentsImpl();
  public named = new NamedArgumentsImpl();
  public blocks = new BlockArgumentsImpl();

  empty(stack: EvaluationStack): this {
    let base = stack._registers_[$sp] + 1;

    this.named._empty_(stack, base);
    this.positional.empty(stack, base);
    this.blocks.empty(stack, base);

    return this;
  }

  setup(
    stack: EvaluationStack,
    names: readonly string[],
    blockNames: readonly string[],
    positionalCount: number,
    atNames: boolean
  ) {
    this.#stack = stack;

    /*
           | ... | blocks      | positional  | named |
           | ... | b0    b1    | p0 p1 p2 p3 | n0 n1 |
     index | ... | 4/5/6 7/8/9 | 10 11 12 13 | 14 15 |
                   ^             ^             ^  ^
                 bbase         pbase       nbase  sp
    */

    let named = this.named;
    let namedCount = names.length;
    let namedBase = stack._registers_[$sp] - namedCount + 1;

    named._setup_(stack, namedBase, namedCount, names, atNames);

    let positional = this.positional;
    let positionalBase = namedBase - positionalCount;

    positional.setup(stack, positionalBase, positionalCount);

    let blocks = this.blocks;
    let blocksCount = blockNames.length;
    let blocksBase = positionalBase - blocksCount * 3;

    blocks.setup(stack, blocksBase, blocksCount, blockNames);
  }

  get base(): number {
    return this.blocks.base;
  }

  get length(): number {
    return this.positional.length + this.named.length + this.blocks._length_ * 3;
  }

  at(pos: number): Reference {
    return this.positional.at(pos);
  }

  _realloc_(offset: number) {
    let stack = this.#stack;
    if (offset > 0 && stack !== null) {
      let { positional, named } = this;
      let newBase = positional.base + offset;
      let length = positional.length + named.length;

      for (let index = length - 1; index >= 0; index--) {
        stack.copy(index + positional.base, index + newBase);
      }

      positional.base += offset;
      named.base += offset;
      stack._registers_[$sp] += offset;
    }
  }

  capture(): CapturedArguments {
    let positional = this.positional.length === 0 ? EMPTY_POSITIONAL : this.positional.capture();
    let named = this.named.length === 0 ? EMPTY_NAMED : this.named.capture();

    return { named, positional } as CapturedArguments;
  }

  clear(): void {
    let { length } = this;
    let stack = this.#stack;
    if (length > 0 && stack !== null) stack.pop(length);
  }
}

const EMPTY_REFERENCES = emptyArray<Reference>();

export class PositionalArgumentsImpl implements PositionalArguments {
  public base = 0;
  public length = 0;

  #stack: EvaluationStack = null as any;
  #lazyReferences: Nullable<readonly Reference[]> = null;

  empty(stack: EvaluationStack, base: number) {
    this.#stack = stack;
    this.base = base;
    this.length = 0;

    this.#lazyReferences = EMPTY_REFERENCES;
  }

  setup(stack: EvaluationStack, base: number, length: number) {
    this.#stack = stack;
    this.base = base;
    this.length = length;

    this.#lazyReferences = length === 0 ? EMPTY_REFERENCES : null;
  }

  at(position: number): Reference {
    let { base, length } = this;

    if (position < 0 || position >= length) {
      return UNDEFINED_REFERENCE;
    }

    return check(this.#stack.get(position, base), CheckReference);
  }

  capture(): CapturedPositionalArguments {
    return this.#references as CapturedPositionalArguments;
  }

  prepend(other: Reference[]) {
    let additions = other.length;

    if (additions > 0) {
      let { base, length } = this;

      this.base = base = base - additions;
      this.length = length + additions;

      for (let index = 0; index < additions; index++) {
        this.#stack.set(other[index], index, base);
      }

      this.#lazyReferences = null;
    }
  }

  get #references(): readonly Reference[] {
    let references = this.#lazyReferences;

    if (!references) {
      let { base, length } = this;
      references = this.#lazyReferences = this.#stack.slice<Reference>(base, base + length);
    }

    return references;
  }
}

export class NamedArgumentsImpl implements NamedArguments {
  public base = 0;
  public length = 0;

  #stack: EvaluationStack | undefined;

  #lazyReferences: Nullable<readonly Reference[]> = null;
  #lazyNames: Nullable<readonly string[]> = EMPTY_STRING_ARRAY;
  #atNames: Nullable<readonly string[]> = EMPTY_STRING_ARRAY;

  _empty_(stack: EvaluationStack, base: number) {
    this.#stack = stack;
    this.base = base;
    this.length = 0;

    this.#lazyReferences = EMPTY_REFERENCES;
    this.#lazyNames = EMPTY_STRING_ARRAY;
    this.#atNames = EMPTY_STRING_ARRAY;
  }

  _setup_(
    stack: EvaluationStack,
    base: number,
    length: number,
    names: readonly string[],
    atNames: boolean
  ) {
    this.#stack = stack;
    this.base = base;
    this.length = length;

    if (length === 0) {
      this.#lazyReferences = EMPTY_REFERENCES;
      this.#lazyNames = EMPTY_STRING_ARRAY;
      this.#atNames = EMPTY_STRING_ARRAY;
    } else {
      this.#lazyReferences = null;

      if (atNames) {
        this.#lazyNames = null;
        this.#atNames = names;
      } else {
        this.#lazyNames = names;
        this.#atNames = null;
      }
    }
  }

  get #names(): readonly string[] {
    let names = this.#lazyNames;

    if (!names) {
      names = this.#lazyNames = this.#atNames!.map(toSyntheticName);
    }

    return names;
  }

  get atNames(): readonly string[] {
    let atNames = this.#atNames;

    if (!atNames) {
      atNames = this.#atNames = this.#lazyNames!.map(toAtName);
    }

    return atNames;
  }

  has(name: string): boolean {
    return this.#names.includes(name);
  }

  get(name: string, atNames = false): Reference {
    let { base } = this;

    let names = atNames ? this.atNames : this.#names;

    let index = names.indexOf(name);

    if (index === -1) {
      return UNDEFINED_REFERENCE;
    }

    let reference = unwrap(this.#stack).get<Reference>(index, base);

    return import.meta.env.DEV ? createDebugAliasRef!(atNames ? name : `@${name}`, reference) : reference;
  }

  capture(): CapturedNamedArguments {
    let map = dict<Reference>();

    for (const [index, name] of enumerate(this.#names)) {
      map[name] = import.meta.env.DEV ? createDebugAliasRef!(`@${name}`, unwrap(this.#references[index])) : unwrap(this.#references[index]);
    }

    return map as CapturedNamedArguments;
  }

  _merge_(...others: Record<string, Reference>[]) {
    this.#merge(Object.assign({}, ...others));
  }

  #merge(other: Record<string, Reference>) {
    let keys = Object.keys(other);

    if (keys.length > 0) {
      let { length } = this;
      let newNames = [...this.#names];

      for (const name of keys) {
        let index = newNames.indexOf(name);

        if (index === -1) {
          length = newNames.push(name);
          unwrap(this.#stack).push(other[name]);
        }
      }

      this.length = length;
      this.#lazyReferences = null;
      this.#lazyNames = newNames;
      this.#atNames = null;
    }
  }

  get #references(): readonly Reference[] {
    let references = this.#lazyReferences;

    if (!references) {
      let { base, length } = this;
      references = this.#lazyReferences = unwrap(this.#stack).slice<Reference>(base, base + length);
    }

    return references;
  }
}

function toSyntheticName(this: void, name: string): string {
  return name.slice(1);
}

function toAtName(this: void, name: string): string {
  return `@${name}`;
}

function toSymbolName(name: string): string {
  return `&${name}`;
}

const EMPTY_BLOCK_VALUES = emptyArray<BlockValue>();

export class BlockArgumentsImpl implements BlockArguments {
  #stack: EvaluationStack | undefined;
  #internalValues: Nullable<readonly BlockValue[]> = null;
  #symbolNames: Nullable<readonly string[]> = null;

  public internalTag: Nullable<Tag> = null;
  public _names_: readonly string[] = EMPTY_STRING_ARRAY;

  public _length_ = 0;
  public base = 0;

  empty(stack: EvaluationStack, base: number) {
    this.#stack = stack;
    this._names_ = EMPTY_STRING_ARRAY;
    this.base = base;
    this._length_ = 0;
    this.#symbolNames = null;

    this.internalTag = CONSTANT_TAG;
    this.#internalValues = EMPTY_BLOCK_VALUES;
  }

  setup(stack: EvaluationStack, base: number, length: number, names: readonly string[]) {
    this.#stack = stack;
    this._names_ = names;
    this.base = base;
    this._length_ = length;
    this.#symbolNames = null;

    if (length === 0) {
      this.internalTag = CONSTANT_TAG;
      this.#internalValues = EMPTY_BLOCK_VALUES;
    } else {
      this.internalTag = null;
      this.#internalValues = null;
    }
  }

  get values(): readonly BlockValue[] {
    let values = this.#internalValues;

    if (!values) {
      let { base, _length_ } = this;
      values = this.#internalValues = unwrap(this.#stack).slice<BlockValue>(
        base,
        base + _length_ * 3
      );
    }

    return values;
  }

  has(name: string): boolean {
    return this._names_.includes(name);
  }

  get(name: string): Nullable<ScopeBlock> {
    let index = this._names_.indexOf(name);

    if (index === -1) {
      return null;
    }

    let { base } = this;
    let stack = unwrap(this.#stack);

    let table = check(stack.get(index * 3, base), CheckOption(CheckBlockSymbolTable));
    let scope = check(stack.get(index * 3 + 1, base), CheckOption(CheckScope));
    let handle = check(
      stack.get(index * 3 + 2, base),
      CheckOption(CheckOr(CheckHandle, CheckCompilableBlock))
    );

    return handle === null ? null : ([handle, scope!, table!] as ScopeBlock);
  }

  capture(): CapturedBlockArguments {
    return new CapturedBlockArgumentsImpl(this._names_, this.values);
  }

  get symbolNames(): readonly string[] {
    let symbolNames = this.#symbolNames;

    if (symbolNames === null) {
      symbolNames = this.#symbolNames = this._names_.map(toSymbolName);
    }

    return symbolNames;
  }
}

class CapturedBlockArgumentsImpl implements CapturedBlockArguments {
  public length: number;

  constructor(public names: readonly string[], public values: readonly Nullable<BlockValue>[]) {
    this.length = names.length;
  }

  has(name: string): boolean {
    return this.names.includes(name);
  }

  get(name: string): Nullable<ScopeBlock> {
    let index = this.names.indexOf(name);

    if (index === -1) return null;

    return [
      this.values[index * 3 + 2] as CompilableBlock,
      this.values[index * 3 + 1] as Scope,
      this.values[index * 3] as BlockSymbolTable,
    ];
  }
}

export function createCapturedArgs(named: Dict<Reference>, positional: Reference[]) {
  return {
    named,
    positional,
  } as CapturedArguments;
}

export function reifyNamed(named: CapturedNamedArguments) {
  let reified = dict();

  for (const [key, value] of Object.entries(named)) {
    reified[key] = valueForRef(value);
  }

  return reified;
}

export function reifyPositional(positional: CapturedPositionalArguments) {
  return positional.map(valueForRef);
}

export function reifyArgs(args: CapturedArguments) {
  return {
    named: reifyNamed(args.named),
    positional: reifyPositional(args.positional),
  };
}

export const EMPTY_NAMED = Object.freeze(Object.create(null)) as CapturedNamedArguments;
export const EMPTY_POSITIONAL = EMPTY_REFERENCES as CapturedPositionalArguments;
export const EMPTY_ARGS = createCapturedArgs(EMPTY_NAMED, EMPTY_POSITIONAL);
