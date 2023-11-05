import type { NodeType } from '@glimmer/interfaces';

export * from './array-utils';
export { default as assert, deprecate } from './assert';
export * from './collections';
export * from './constants';
export { beginTestSteps, endTestSteps, logStep, verifySteps } from './debug-steps';
export { default as debugToString } from './debug-to-string';
export * from './dom';
export * from './dom-utils';
export * from './error';
export * from './immediate';
export { default as intern } from './intern';
export {
  isSerializationFirstNode,
  SERIALIZATION_FIRST_NODE_STRING,
} from './is-serialization-first-node';
export { array, assign, entries, fillNulls, type FixedArray, values } from './object-utils';
export * from './platform-utils';
export * from './present';
export * from './result';
export {
  castToBrowser,
  castToSimple,
  checkBrowserNode as checkNode,
  isElement,
  isSimpleElement,
} from './simple-cast';
export * from './stack';
export * from './string';
export * from './template';
export * from './types';
export { default as buildUntouchableThis } from './untouchable-this';

export type FIXME<T, S extends string> = (T & S) | T;

/**
 * This constant exists to make it easier to differentiate normal logs from
 * errant console.logs. LOCAL_LOGGER should only be used inside a
 * LOCAL_SHOULD_LOG check.
 *
 * It does not alleviate the need to check LOCAL_SHOULD_LOG, which is used
 * for stripping.
 */
export const LOCAL_LOGGER = console;

/**
 * This constant exists to make it easier to differentiate normal logs from
 * errant console.logs. LOGGER can be used outside of LOCAL_SHOULD_LOG checks,
 * and is meant to be used in the rare situation where a console.* call is
 * actually appropriate.
 */
export const LOGGER = console;

export function assertNever(value: never, desc = 'unexpected unreachable branch'): never {
  LOGGER.log('unreachable', value);
  LOGGER.log(`${desc} :: ${JSON.stringify(value)} (${value})`);

  throw new Error(`code reached unreachable`);
}

export const NODE_TYPE = {
  ELEMENT: 1 as NodeType.ELEMENT_NODE,
  RAW: -1 as NodeType.RAW_NODE,
  TEXT: 3 as NodeType.TEXT_NODE,
  COMMENT: 8 as NodeType.COMMENT_NODE,
  DOCUMENT: 9 as NodeType.DOCUMENT_NODE,
  DOCUMENT_TYPE: 10 as NodeType.DOCUMENT_TYPE_NODE,
  DOCUMENT_FRAGMENT: 11 as NodeType.DOCUMENT_FRAGMENT_NODE,
} as const;
