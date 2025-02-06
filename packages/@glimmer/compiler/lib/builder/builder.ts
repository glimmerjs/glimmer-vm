import type {
  AppendLexicalOpcode,
  AppendResolvedOpcode,
  CallLexicalOpcode,
  CallResolvedOpcode,
  Dict,
  Expressions,
  LexicalModifierOpcode,
  Optional,
  ResolvedModifierOpcode,
  WireFormat,
} from '@glimmer/interfaces';
import type { RequireAtLeastOne, Simplify } from 'type-fest';
import { localAssert } from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { dict, values } from '@glimmer/util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

export interface Symbols {
  top: ProgramSymbols;
  freeVar(name: string): number;
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

  freeVar(name: string): number {
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

  freeVar(name: string): number {
    return this.parent.freeVar(name);
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

export function buildAppend(
  trusted: boolean,
  expr: Expressions.Expression
): WireFormat.Content.SomeAppend {
  if (Array.isArray(expr)) {
    if (expr[0] === Op.GetFreeAsComponentOrHelperHead) {
      return trusted
        ? [Op.UnknownTrustingAppend, expr as Expressions.GetUnknownAppend]
        : [Op.UnknownAppend, expr as Expressions.GetUnknownAppend];
    } else if (isInvokeResolved(expr)) {
      return [Op.AppendResolved, expr];
    } else if (isInvokeLexical(expr)) {
      return [Op.AppendLexical, expr];
    }
  }

  if (Array.isArray(expr)) {
    return [trusted ? Op.AppendTrustedHtml : Op.Append, expr];
  } else {
    return [Op.AppendStatic, expr];
  }
}

type CallType =
  /**
   * Dynamic means the value is dynamic (i.e. a local variable or expression and has no special
   * opcode compilation behavior).
   *
   * Resolved or lexical values have special cases in the opcode compiler since their value is known
   * at opcode compilation time. As a result, their compiled templates can be specialized based on
   * their specified capabilities.
   */
  | 'dynamic'
  /**
   * Resolver means that the value needs to be resolved via the resolver (i.e. it's a "resolved
   * component" or a "resolved helper").
   */
  | 'resolver'
  /**
   * Lexical means a reference to the JavaScript environment outside of the template.
   */
  | 'lexical'
  /**
   * Keyword means that the callee is a keyword (e.g. `{{if ...}}` or `(if ...)`).
   */
  | 'keyword';

export const APPEND_TYPES = {
  resolver: Op.AppendResolved,
  keyword: Op.AppendResolved,
  lexical: Op.AppendLexical,
  dynamic: Op.AppendLexical,
} satisfies Record<CallType, AppendResolvedOpcode | AppendLexicalOpcode>;

export const CALL_TYPES = {
  resolver: Op.CallResolved,
  keyword: Op.CallResolved,
  lexical: Op.CallLexical,
  dynamic: Op.CallLexical,
} satisfies Record<CallType, CallResolvedOpcode | CallLexicalOpcode>;

export const MODIFIER_TYPES = {
  resolver: Op.ResolvedModifier,
  keyword: Op.ResolvedModifier,
  lexical: Op.LexicalModifier,
  dynamic: Op.LexicalModifier,
} satisfies Record<CallType, ResolvedModifierOpcode | LexicalModifierOpcode>;

const HEAD_TYPES_MAP = {
  [Op.GetLexicalSymbol]: 'lexical',
  [Op.CallResolved]: 'dynamic',
  [Op.GetLocalSymbol]: 'dynamic',
  [Op.GetFreeAsComponentOrHelperHead]: 'resolver',
  [Op.GetFreeAsHelperHead]: 'resolver',
  [Op.GetFreeAsModifierHead]: 'resolver',
  [Op.Curry]: 'dynamic',
  [Op.IfInline]: 'dynamic',
} as const;

type HeadType = keyof typeof HEAD_TYPES_MAP;

export function headType(expr: Expressions.Expression, from: string): CallType {
  if (!Array.isArray(expr)) {
    throw Error('Something is suspicious @fixme');
  }

  let type = expr[0];

  localAssert(type in HEAD_TYPES_MAP, `Unexpected opcode ${type} in ${from}`);

  return HEAD_TYPES_MAP[type as HeadType];
}

export function buildComponentArgs(
  splattributes: Optional<WireFormat.Core.Splattributes>,
  hash: Optional<WireFormat.Core.Hash>,
  blocks: Optional<WireFormat.Core.Blocks>
): Optional<WireFormat.Core.ComponentArgs> {
  return compact({
    splattributes,
    hash,
    blocks,
  });
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

export function isGetPath(path: Expressions.Expression): path is WireFormat.Expressions.GetPath {
  if (!Array.isArray(path) || path.length !== 3) return false;

  switch (path[0]) {
    case Op.GetLocalSymbol:
    case Op.GetLexicalSymbol:
      return true;
    default:
      return isGetContextualFree(path);
  }
}

export function isInvokeLexical(
  expr: Expressions.Expression
): expr is WireFormat.Expressions.SomeInvoke {
  if (!isTupleExpression(expr)) return false;

  return expr[0] === Op.CallLexical;
}

export function isInvokeResolved(
  expr: Expressions.Expression
): expr is WireFormat.Expressions.SomeInvoke {
  if (!isTupleExpression(expr)) return false;

  return expr[0] === Op.CallResolved;
}

export function isGetSymbolOrPath(
  path: Expressions.Expression
): path is WireFormat.Expressions.GetLocalSymbol | WireFormat.Expressions.GetPathSymbol {
  return isTupleExpression(path) && path[0] === Op.GetLocalSymbol;
}

export function isGetVar(path: Expressions.Expression): path is WireFormat.Expressions.GetVar[0] {
  if (!Array.isArray(path) || path.length !== 2) return false;

  switch (path[0]) {
    case Op.GetLocalSymbol:
    case Op.GetLexicalSymbol:
    case Op.GetStrictKeyword:
      return true;
    default:
      return isGetContextualFree(path);
  }
}

export function isTupleExpression(
  path: Expressions.Expression
): path is WireFormat.Expressions.TupleExpression {
  return Array.isArray(path);
}

export function isGetContextualFree(
  path: Expressions.TupleExpression
): path is WireFormat.Expressions.GetResolved {
  switch (path[0]) {
    case Op.GetFreeAsComponentOrHelperHead:
    case Op.GetFreeAsHelperHead:
    case Op.GetFreeAsModifierHead:
    case Op.GetFreeAsComponentHead:
      return true;
    default:
      return false;
  }
}

export function isGet(expr: Expressions.Expression): expr is Expressions.Get {
  return isGetVar(expr) || isGetPath(expr);
}

export function assertGet(expr: Expressions.Expression): asserts expr is Expressions.Get {
  if (LOCAL_DEBUG) {
    localAssert(isGet(expr), `Expected ${JSON.stringify(expr)} to be a Get`);
  }
}

export function needsAtNames(path: Expressions.Get): boolean {
  return isGetLexical(path) || path.length === 2;
}
