import state from '@glimmer/state';

export {
  type AbstractIterator,
  createIteratorItemRef,
  createIteratorRef,
  type IterationItem,
  type IteratorDelegate,
  type OpaqueIterationItem,
  type OpaqueIterator,
} from './lib/iterable';
export {
  childRefFor,
  childRefFromParts,
  createComputeRef,
  createConstRef,
  createDebugAliasRef,
  createInvokableRef,
  createPrimitiveRef,
  createReadOnlyRef,
  createUnboundRef,
  FALSE_REFERENCE,
  isConstRef,
  isInvokableRef,
  isUpdatableRef,
  NULL_REFERENCE,
  type Reference,
  type ReferenceEnvironment,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  updateRef,
} from './lib/reference';
export { valueForRef } from '@glimmer/fundamental';

export const REFERENCE = state.REFERENCE;
