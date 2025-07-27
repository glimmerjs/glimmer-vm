import type { Dict, Expressions, Optional, WireFormat } from '@glimmer/interfaces';
import type { RequireAtLeastOne, Simplify } from 'type-fest';
import { dict, values } from '@glimmer/util';
import {
  BLOCKS_OPCODE,
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

export interface Symbols {
  top: ProgramSymbols;
  resolved(name: string): number;
  arg(name: string): number;
  block(name: string): number;
  local(name: string): number;
  this(): number;

  hasLocal(name: string): boolean;

  child(params: string[]): LocalSymbols;
}

export class ProgramSymbols implements Symbols {
  _freeVariables: string[] = [];
  _symbols: string[] = ['this'];

  top = this;

  toSymbols(): string[] {
    return this._symbols.slice(1);
  }

  toUpvars(): string[] {
    return this._freeVariables;
  }

  resolved(name: string): number {
    return addString(this._freeVariables, name);
  }

  block(name: string): number {
    return this.symbol(name);
  }

  arg(name: string): number {
    return addString(this._symbols, name);
  }

  local(name: string): never {
    throw new Error(
      `No local ${name} was found. Maybe you meant ^${name} for upvar, or !${name} for keyword?`
    );
  }

  this(): number {
    return 0;
  }

  hasLocal(_name: string): false {
    return false;
  }

  // any symbol
  symbol(name: string): number {
    return addString(this._symbols, name);
  }

  child(locals: string[]): LocalSymbols {
    return new LocalSymbols(this, locals);
  }
}

class LocalSymbols implements Symbols {
  private locals: Dict<number> = dict();

  constructor(
    private parent: Symbols,
    locals: string[]
  ) {
    for (let local of locals) {
      this.locals[local] = parent.top.symbol(local);
    }
  }

  get paramSymbols(): number[] {
    return values(this.locals);
  }

  get top(): ProgramSymbols {
    return this.parent.top;
  }

  resolved(name: string): number {
    return this.parent.resolved(name);
  }

  arg(name: string): number {
    return this.parent.arg(name);
  }

  block(name: string): number {
    return this.parent.block(name);
  }

  local(name: string): number {
    if (name in this.locals) {
      return this.locals[name] as number;
    } else {
      return this.parent.local(name);
    }
  }

  this(): number {
    return this.parent.this();
  }

  hasLocal(name: string): boolean {
    if (name in this.locals) {
      return true;
    } else {
      return this.parent.hasLocal(name);
    }
  }

  child(locals: string[]): LocalSymbols {
    return new LocalSymbols(this, locals);
  }
}

function addString(array: string[], item: string): number {
  let index = array.indexOf(item);

  if (index === -1) {
    index = array.length;
    array.push(item);
    return index;
  } else {
    return index;
  }
}

export interface BuilderGetFree {
  type: 'GetFree';
  head: string;
  tail: string[];
}

export function buildComponentArgs(
  splattributes: Optional<WireFormat.Core.Splattributes>,
  hash: Optional<WireFormat.Core.Hash>,
  componentBlocks: Optional<WireFormat.Core.Blocks>
): WireFormat.Core.BlockArgs {
  const blocks = combineSplattributes(componentBlocks, splattributes);

  if (hash && blocks) {
    return [NAMED_ARGS_AND_BLOCKS_OPCODE, hash, blocks];
  } else if (hash) {
    return [NAMED_ARGS_OPCODE, hash];
  } else if (blocks) {
    return [BLOCKS_OPCODE, blocks];
  } else {
    return [EMPTY_ARGS_OPCODE];
  }
}

function combineSplattributes(
  blocks: Optional<WireFormat.Core.Blocks>,
  splattributes: Optional<WireFormat.Core.Splattributes>
): Optional<WireFormat.Core.Blocks> {
  if (blocks && splattributes) {
    return [
      [...blocks[0], 'attrs'],
      [...blocks[1], [splattributes, []] satisfies WireFormat.SerializedInlineBlock],
    ];
  } else if (splattributes) {
    return [['attrs'], [[splattributes, []] satisfies WireFormat.SerializedInlineBlock]];
  } else {
    return blocks;
  }
}

type CompactObject<T> = Simplify<
  RequireAtLeastOne<
    {
      [K in keyof T as undefined extends T[K] ? never : K]: T[K];
    } & {
      [K in keyof T as undefined extends T[K] ? K : never]?: NonNullable<T[K]>;
    }
  >
>;

/**
 * Remove all `undefined` values from an object.
 *
 * The return type:
 *
 * - removes all properties whose value is literally `undefined`.
 * - replaces properties whose value is `T | undefined` with an optional property with the value
 *   `T`.
 *
 * Example:
 *
 * ```ts
 * interface Foo {
 *   foo?: number;
 *   bar: number | undefined;
 *   baz: number;
 *   bat?: number | undefined;
 * }
 *
 * const obj: Foo = {
 *   bar: 123,
 *   baz: 456,
 *   bat: undefined
 * };
 *
 * const compacted = compact(obj);
 *
 * // compacted is now:
 * interface Foo {
 *   foo?: number;
 *   bar?: number;
 *   baz: number;
 *   bat?: number;
 * }
 * ```
 */
export function compact<T extends object>(
  object: T | undefined
): Optional<Simplify<CompactObject<T>>> {
  if (!object) return;

  const entries = Object.entries(object).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Simplify<CompactObject<T>> | undefined;
}

export function isGetLexical(
  path: Expressions.Expression
): path is WireFormat.Expressions.GetLexicalSymbol {
  return Array.isArray(path) && path.length === 2 && path[0] === Op.GetLexicalSymbol;
}

export function isGetPath(_path: Expressions.Expression): _path is never {
  // GetPath no longer exists in flat wire format
  return false;
}

export function isInvokeDynamicValue(
  expr: Expressions.Expression
): expr is WireFormat.Expressions.SomeCallHelper {
  return Array.isArray(expr) && expr[0] === Op.CallDynamicValue;
}

export function isInvokeResolved(
  expr: Expressions.Expression
): expr is WireFormat.Expressions.CallResolvedHelper {
  return Array.isArray(expr) && expr[0] === Op.CallResolved;
}

export function isGetSymbolOrPath(
  path: Expressions.Expression
): path is WireFormat.Expressions.GetLocalSymbol {
  return Array.isArray(path) && path[0] === Op.GetLocalSymbol;
}

export function isGetVar(path: Expressions.Expression): path is WireFormat.Expressions.GetVar {
  return Array.isArray(path) && (path[0] === Op.GetLocalSymbol || path[0] === Op.GetLexicalSymbol);
}

export function isTupleExpression(
  path: Expressions.Expression
): path is WireFormat.Expressions.TupleExpression {
  return Array.isArray(path);
}

export function isGet(expr: Expressions.Expression): expr is Expressions.Get {
  return isGetVar(expr);
}

export function needsAtNames(path: Expressions.Get): boolean {
  return isGetLexical(path) || path.length === 2;
}
