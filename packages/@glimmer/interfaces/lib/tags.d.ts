declare const TYPE: unique symbol;
export type TagTypeSymbol = typeof TYPE;

declare const COMPUTE: unique symbol;
export type TagComputeSymbol = typeof COMPUTE;

export type CONSTANT_REVISION = 0;
export type INITIAL_REVISION = 1;

export type DirtyableTagId = 0;
export type UpdatableTagId = 1;
export type CombinatorTagId = 2;
export type ConstantTagId = 3;
export type CurrentTagId = 101;

/**
 * This union represents all of the possible tag types for the monomorphic tag class.
 * Other custom tag classes can exist, such as CurrentTag and VolatileTag, but for
 * performance reasons, any type of tag that is meant to be used frequently should
 * be added to the monomorphic tag.
 */
export type TagId =
  | DirtyableTagId
  | UpdatableTagId
  | CurrentTagId
  | CombinatorTagId
  | ConstantTagId;

export type Revision = number;

export interface Tag<T extends TagId = TagId> {
  readonly [TYPE]: T;
  readonly subtag?: Tag | Tag[] | null | undefined;
  [COMPUTE](): Revision;
}

export type DirtyableTag = Tag<DirtyableTagId>;
export type UpdatableTag = Tag<UpdatableTagId>;
export type CurrentTag = Tag<CurrentTagId>;
export type CombinatorTag = Tag<CombinatorTagId>;
export type ConstantTag = Tag<ConstantTagId>;
