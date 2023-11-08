import type { NodeType } from '@glimmer/interfaces';

export * from './array-utils';
export * from './collections';
export * from './constants';
export { beginTestSteps, endTestSteps, logStep, verifySteps } from './debug-steps';
export { default as debugToString } from './debug-to-string';
export * from './devmode/assert';
export * from './devmode/description';
export * from './devmode/logging';
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

export const NODE_TYPE = {
  ELEMENT: 1 as NodeType.ELEMENT_NODE,
  RAW: -1 as NodeType.RAW_NODE,
  TEXT: 3 as NodeType.TEXT_NODE,
  COMMENT: 8 as NodeType.COMMENT_NODE,
  DOCUMENT: 9 as NodeType.DOCUMENT_NODE,
  DOCUMENT_TYPE: 10 as NodeType.DOCUMENT_TYPE_NODE,
  DOCUMENT_FRAGMENT: 11 as NodeType.DOCUMENT_FRAGMENT_NODE,
} as const;
