import { exhausted } from './platform-utils';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

let checkInt: undefined | ((num: number, min?: number, max?: number) => void);

if (LOCAL_DEBUG) {
  // eslint-disable-next-line no-var,vars-on-top
  checkInt = (num: number, min = -2147483648, max = 2147483647) => {
    if (!isInt(num, min, max)) {
      throw new Error(`expected ${num} to be an integer between ${min} to ${max}`);
    }
  };
}

/*
Encoding notes

first
2 bits    start        end
0 1       1073741824   2147483647   direct negative or boolean or null or undefined
0 0       0            1073741823   direct positive
1 1       -1           -1073741824  string index
1 0       -1073741825  -2147483648  number index

Since first bit is the sign bit then

encoded >= 0  is all directly encoded values
encoded < 0  is all indirect encoded values (encoded indexes)

For directly encoded values
encoded      decoded
0            0
...          ...
1073741823   1073741823
1073741824   false
1073741825   true
1073741826   null
1073741827   undefined
1073741828   -1
...          ...
2147483647   -1073741820

for stack handles
we map js index 0 to 2147483647 onto -1 to -2147483648

for constant handles
we map string index 0 to 1073741823 onto -1 to -1073741824
we map number index 0 to 1073741823 onto -1073741825 to -2147483648
*/

/**
 * Immediates use the positive half of 32 bits 0 through 2147483647 (0x7fffffff)
 * leaving the negative half for handles -1 through -2147483648.
 */
export const enum ImmediateMapping {
  /**
   * Min encoded immediate is min positive
   */
  MAX_IMMEDIATE = -1,

  /**
   * Min encoded immediate is min positive
   */
  MIN_IMMEDIATE = 1 << 31,

  /**
   * Max int we can encode is the maximum positive we can represent - the base
   */
  MAX_INT = 1 << 30,

  /**
   * The encoding of false.
   * False is the start of the second half of 31 bits
   */
  ENCODED_FALSE = MAX_IMMEDIATE,

  /**
   * The encoding of true
   */
  ENCODED_TRUE = ENCODED_FALSE - 1,

  /**
   * The encoding of null
   */
  ENCODED_NULL = ENCODED_TRUE - 1,

  /**
   * The encoding of undefined
   */
  ENCODED_UNDEFINED = ENCODED_NULL - 1,

  /**
   * Encoded just after UNDEFINED
   */
  ENCODED_ZERO = ENCODED_UNDEFINED - 1,

  /**
   * Minimum possible encoding we support
   */
  ENCODED_MIN_INT = MIN_IMMEDIATE,

  /**
   * The minimum int that can be directly encoded vs a handle.
   */
  ENCODED_MAX_INT = ENCODED_ZERO - MAX_INT,

  MIN_INT = MIN_IMMEDIATE - ENCODED_MAX_INT,
}

/**
 * The compiler constants divide the handles into two halves strings and numbers
 * while on the stack, there is only one array of js values.
 */
export const enum HandleConstants {
  HANDLE_LENGTH = 2 ** 31,
  MIN_HANDLE = 0,
  MAX_HANDLE = HANDLE_LENGTH - 1,
}

/**
 * Encodes a value that can be stored directly instead of being a handle.
 *
 * Immediates use the positive half of 32bits
 *
 * @param value - the value to be encoded.
 */
export function encodeImmediate(value: null | undefined | boolean | number) {
  if (typeof value === 'number') {
    if (LOCAL_DEBUG) {
      checkInt!(value, ImmediateMapping.MIN_INT, ImmediateMapping.MAX_INT);
    }

    return value >= 0
      ? ImmediateMapping.ENCODED_ZERO - value
      : value + ImmediateMapping.ENCODED_MAX_INT;
  }
  if (value === false) {
    return ImmediateMapping.ENCODED_FALSE;
  }
  if (value === true) {
    return ImmediateMapping.ENCODED_TRUE;
  }
  if (value === null) {
    return ImmediateMapping.ENCODED_NULL;
  }
  if (value === undefined) {
    return ImmediateMapping.ENCODED_UNDEFINED;
  }
  return exhausted(value);
}

/**
 * Decodes an immediate into its value.
 *
 * @param value - the encoded immediate value
 */
export function decodeImmediate(value: number): null | undefined | boolean | number {
  if (LOCAL_DEBUG) {
    // expected value to be checked before this
    checkInt!(value, ImmediateMapping.MIN_IMMEDIATE, ImmediateMapping.MAX_IMMEDIATE);
  }

  if (value >= ImmediateMapping.ENCODED_MAX_INT) {
    switch (value) {
      case ImmediateMapping.ENCODED_FALSE:
        return false;
      case ImmediateMapping.ENCODED_TRUE:
        return true;
      case ImmediateMapping.ENCODED_NULL:
        return null;
      case ImmediateMapping.ENCODED_UNDEFINED:
        return undefined;
      default:
        return ImmediateMapping.ENCODED_ZERO - value;
    }
  }

  return value - ImmediateMapping.ENCODED_MAX_INT;
}

/**
 * True if the number can be stored directly or false if it needs a handle.
 *
 * This is used on any number type to see if it can be directly encoded.
 */
export function isSmallInt(num: number) {
  return isInt(num, ImmediateMapping.MIN_INT, ImmediateMapping.MAX_INT);
}

/**
 * True if the encoded int32 operand or encoded stack int32 is a handle.
 */
export function isHandle(encoded: number) {
  if (LOCAL_DEBUG) {
    // we expect to only use this method when we already know it is an int32
    // because it was encoded or read from the Int32Array buffer
    checkInt!(encoded);
  }
  return encoded >= 0;
}

/**
 * Encodes an index to an operand or stack handle.
 */
export function encodeHandle(handle: number) {
  if (LOCAL_DEBUG) {
    // expected the index to already be a positive int index from pushing the value
    checkInt!(handle, HandleConstants.MIN_HANDLE, HandleConstants.MAX_HANDLE);
  }

  return handle;
}

/**
 * Decodes the index from the specified operand or stack handle.
 */
export function decodeHandle(handle: number) {
  if (LOCAL_DEBUG) {
    checkInt!(handle, HandleConstants.MIN_HANDLE, HandleConstants.MAX_HANDLE);
  }

  return handle;
}

function isInt(num: number, min: number, max: number): boolean {
  // this is the same as Math.floor(num) === num
  // also NaN % 1 is NaN and Infinity % 1 is NaN so both should fail
  return num % 1 === 0 && num >= min && num <= max;
}

// Warm
[null, true, false, undefined, 1, -1].forEach(x => decodeImmediate(encodeImmediate(x)));
