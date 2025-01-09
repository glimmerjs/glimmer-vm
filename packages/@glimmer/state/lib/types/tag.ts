declare const TYPE: unique symbol;
export type TagTypeSymbol = typeof TYPE;

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

export type ConstantRevision = 0;
export type InitialRevision = 1;

export interface Tag<T extends TagId = TagId> {
  readonly [TYPE]: T;
  readonly subtag?: Tag | Tag[] | null | undefined;
}

export type TagMeta = Map<PropertyKey, Tag<UpdatableTagId>>;
