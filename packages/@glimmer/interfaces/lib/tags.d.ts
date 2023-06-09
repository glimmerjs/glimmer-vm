declare const TYPE: unique symbol;
export type TagTypeSymbol = typeof TYPE;

declare const COMPUTE: unique symbol;
export type TagComputeSymbol = typeof COMPUTE;

export type DIRTYABLE_TAG_ID = 0;
export type UPDATABLE_TAG_ID = 1;
export type COMBINATOR_TAG_ID = 2;
export type CONSTANT_TAG_ID = 3;

/**
 * This union represents all of the possible tag types for the monomorphic tag class.
 * Other custom tag classes can exist, such as CurrentTag and VolatileTag, but for
 * performance reasons, any type of tag that is meant to be used frequently should
 * be added to the monomorphic tag.
 */
export type MonomorphicTagTypeId =
  | DIRTYABLE_TAG_ID
  | UPDATABLE_TAG_ID
  | COMBINATOR_TAG_ID
  | CONSTANT_TAG_ID;

export type VOLATILE_TAG_ID = 100;
export type CURRENT_TAG_ID = 101;

export type PolymorphicTagTypeId = VOLATILE_TAG_ID | CURRENT_TAG_ID;

export type TagTypeId = MonomorphicTagTypeId | PolymorphicTagTypeId;

export type Revision = number;

export type DebugName = string | { key: string; parent: string };

export interface TagDebug {
  id: number;
  type: TagTypeId;
  name: DebugName;
  updatedAt: () => number;
  /**
   * A tag has a subtags array if it's a combinator tag.
   */
  subtags?: TagDebug[] | undefined;

  /**
   * A tag has a delegate if its subtag is a single tag. For practical purposes,
   * the delegate is the tag itself, just not yet fully committed.
   */
  delegate?: TagDebug | undefined;

  toString(): string;
}

export interface Tag {
  readonly [TYPE]: TagTypeId;
  readonly id: number;
  readonly subtag?: Tag | Tag[] | null | undefined;
  readonly debug?: TagDebug;
  [COMPUTE](): Revision;
}

export interface MonomorphicTag extends Tag {
  readonly [TYPE]: MonomorphicTagTypeId;
}

export interface UpdatableTag extends MonomorphicTag {
  readonly [TYPE]: UPDATABLE_TAG_ID;
}

export interface DirtyableTag extends MonomorphicTag {
  readonly [TYPE]: DIRTYABLE_TAG_ID;
}

export interface ConstantTag extends MonomorphicTag {
  readonly [TYPE]: CONSTANT_TAG_ID;
}

export interface CombinatorTag extends MonomorphicTag {
  readonly [TYPE]: COMBINATOR_TAG_ID;
}
