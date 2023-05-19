import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import { assert } from './assert';

/*
  Encoding notes

  We use 30 bit integers for encoding, so that we don't ever encode a non-SMI
  integer to push on the stack.

  Handles are >= 0
  Immediates are < 0

  True, False, Undefined and Null are pushed as handles into the symbol table,
  with well known handles (0, 1, 2, 3)

  The negative space is divided into positives and negatives. Positives are
  higher numbers (-1, -2, -3, etc), negatives are lower.

  We only encode immediates for two reasons:

  1. To transfer over the wire, so they're smaller in general
  2. When pushing values onto the stack from the low level/inner VM, which may
     be converted into WASM one day.

  This allows the low-level VM to always use SMIs, and to minimize using JS
  values via handles for things like the stack pointer and frame pointer.
  Externally, most code pushes values as JS values, except when being pulled
  from the append byte code where it was already encoded.

  Logically, this is because the low level VM doesn't really care about these
  higher level values. For instance, the result of a userland helper may be a
  number, or a boolean, or undefined/null, but it's extra work to figure that
  out and push it correctly, vs. just pushing the value as a JS value with a
  handle.

  Note: The details could change here in the future, this is just the current
  strategy.
*/
export const MAX_SMI = 2 ** 30 - 1;
export const MIN_SMI = ~MAX_SMI;
export const SIGN_BIT = ~(2 ** 29);
export const MAX_INT = ~SIGN_BIT - 1;
export const MIN_INT = ~MAX_INT;

export const FALSE_HANDLE = 0;
export const TRUE_HANDLE = 1;
export const NULL_HANDLE = 2;
export const UNDEFINED_HANDLE = 3;

export const ENCODED_FALSE_HANDLE = FALSE_HANDLE;
export const ENCODED_TRUE_HANDLE = TRUE_HANDLE;
export const ENCODED_NULL_HANDLE = NULL_HANDLE;
export const ENCODED_UNDEFINED_HANDLE = UNDEFINED_HANDLE;

export function isHandle(value: number) {
  return value >= 0;
}

export function isNonPrimitiveHandle(value: number) {
  return value > ENCODED_UNDEFINED_HANDLE;
}

export function constants(...values: unknown[]): unknown[] {
  return [false, true, null, undefined, ...values];
}

export function isSmallInt(value: number) {
  return value % 1 === 0 && value <= MAX_INT && value >= MIN_INT;
}

export function encodeNegative(integer: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(
      integer % 1 === 0 && integer >= MIN_INT && integer < 0,
      `Could not encode negative: ${integer}`
    );
  }

  return integer & SIGN_BIT;
}

export function decodeNegative(int32: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(
      int32 % 1 === 0 && int32 < ~MAX_INT && int32 >= MIN_SMI,
      `Could not decode negative: ${int32}`
    );
  }

  return int32 | ~SIGN_BIT;
}

export function encodePositive(integer: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(
      integer % 1 === 0 && integer >= 0 && integer <= MAX_INT,
      `Could not encode positive: ${integer}`
    );
  }

  return ~integer;
}

export function decodePositive(int32: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(
      int32 % 1 === 0 && int32 <= 0 && int32 >= ~MAX_INT,
      `Could not decode positive: ${int32}`
    );
  }

  return ~int32;
}

export function encodeHandle(integer: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(
      integer % 1 === 0 && integer >= 0 && integer <= MAX_SMI,
      `Could not encode handle: ${integer}`
    );
  }

  return integer;
}

/* @__INLINE__ */
export function decodeHandle(int32: number) {
  if (import.meta.env.DEV && LOCAL_DEBUG) {
    assert(int32 % 1 === 0 && int32 <= MAX_SMI && int32 >= 0, `Could not decode handle: ${int32}`);
  }

  return int32;
}

export function encodeImmediate(immediate: number) {
  immediate = to32Bit(immediate);
  return immediate < 0 ? encodeNegative(immediate) : encodePositive(immediate);
}

export function decodeImmediate(int32: number) {
  int32 = to32Bit(int32);
  return int32 > SIGN_BIT ? decodePositive(int32) : decodeNegative(int32);
}

export function encodeBoolean(value: boolean) {
  return value ? TRUE_HANDLE : FALSE_HANDLE;
}

export function decodeBoolean(value: number) {
  return value === TRUE_HANDLE;
}

export function to32Bit(value: number) {
  // eslint-disable-next-line unicorn/prefer-math-trunc
  return value | 0;
}

// Warm
for (const x of [1, 2, 3]) decodeHandle(encodeHandle(x));
for (const x of [1, -1]) decodeImmediate(encodeImmediate(x));
