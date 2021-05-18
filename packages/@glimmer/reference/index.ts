export {
  createPrimitiveSource,
  createUnboundSource,
  createUpdatableCacheSource,
  createDebugAliasSource,
  createReadOnlySource,
  createInvokableSource,
  isInvokableSource,
  isUpdatableSource,
  updateSource,
  pathSourceFor,
  pathSourceFromParts,
  UNDEFINED_SOURCE,
  NULL_SOURCE,
  TRUE_SOURCE,
  FALSE_SOURCE,
} from './lib/reference';

export {
  IterationItem,
  OpaqueIterationItem,
  OpaqueIterator,
  AbstractIterator,
  IteratorDelegate,
  createIteratorSource,
  createIteratorItemSource,
} from './lib/iterable';
