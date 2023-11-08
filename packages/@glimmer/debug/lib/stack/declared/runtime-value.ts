import type {
  BlockSymbolTable,
  CompilableBlock,
  Nullable,
  Scope,
  ScopeBlock,
} from '@glimmer/interfaces';
import type {SomeReactive} from '@glimmer/reference';
import type { AnyFunction } from '@glimmer/util';
import type { DebugState } from '../../render/state';
import type { FallibleCheckResult } from '../types';

import { readReactive  } from '@glimmer/reference';

import { isReference } from '../../utils';
import { define } from './define-runtime-value';
import { MISMATCH, ok } from './shared';

export const RegisterRa = define(
  'register/ra',
  'the value of the $ra register',
  (value, debug: DebugState) => {
    return value === debug.registers.frame.$ra ? ok(value) : MISMATCH;
  }
);

export const RefFunction = define('ref/function', 'a function ref', (reference) => {
  if (isReference(reference)) {
    return deref(reference, (value): value is AnyFunction => typeof value === 'function');
  } else {
    return MISMATCH;
  }
});

function deref<const T, const U extends T>(
  reference: SomeReactive<T>,
  check: (value: T) => value is U
): FallibleCheckResult<Deref<U>> {
  try {
    const result = readReactive(reference);

    if (result.type === 'err') {
      return { error: 'deref', threw: result.value };
    }

    const value = result.value;

    if (check(value)) {
      return ok({
        reference: reference as unknown as SomeReactive<U>,
        value,
      } satisfies Deref<U>);
    } else {
      return MISMATCH;
    }
  } catch (e) {
    return { error: 'deref', threw: e };
  }
}

export type DebugTypeName = RuntimeValueSpec[0];
export interface ErrorSpec {
  readonly expected: string;
  readonly got: number;
}

// Ideally this would have a type because we'd like to be able to present it in
// the debugger.
type TODO = unknown;

interface Deref<T> {
  readonly reference: SomeReactive<T>;
  readonly value: T;
}

export type RuntimeValueSpec =
  | readonly ['register/ra', number]
  | readonly ['ref/function', Deref<AnyFunction>]
  | readonly ['ref/function?', Nullable<Deref<AnyFunction>>]
  | readonly ['ref/boolean', Deref<boolean>]
  | readonly ['ref/any', Deref<unknown>]
  | readonly ['block/compilable', CompilableBlock]
  | readonly ['block/compilable?', Nullable<CompilableBlock>]
  | readonly ['block/scope', ScopeBlock]
  | readonly ['block/scope?', Nullable<ScopeBlock>]
  | readonly ['scope', Scope]
  | readonly ['table/block', BlockSymbolTable]
  | readonly ['table/block?', Nullable<BlockSymbolTable>]
  | readonly ['args', TODO]
  // basically dynamic for now -- meant to be used with `peek`
  | readonly ['stack/args', void]
  | readonly ['deref/error', Error];
export type RuntimeValueSpecName = RuntimeValueSpec[0];
