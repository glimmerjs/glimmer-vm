import type {
  CombinatorTagId,
  ConstantTagId,
  CurrentTagId,
  DirtyableTagId,
  Tag,
  UpdatableTagId,
} from '@glimmer/state';

export type CONSTANT_REVISION = 0;
export type INITIAL_REVISION = 1;

export type DirtyableTag = Tag<DirtyableTagId>;
export type UpdatableTag = Tag<UpdatableTagId>;
export type CurrentTag = Tag<CurrentTagId>;
export type CombinatorTag = Tag<CombinatorTagId>;
export type ConstantTag = Tag<ConstantTagId>;
