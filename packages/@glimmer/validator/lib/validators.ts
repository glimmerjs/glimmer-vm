import type {
  CONSTANT_REVISION,
  ConstantTagId,
  CurrentTagId,
  DirtyableTag,
  DirtyableTagId,
  INITIAL_REVISION,
  Tag,
  UpdatableTag,
  UpdatableTagId,
} from '@glimmer/interfaces';
import { combineTags, now, TagImpl, valueForTag } from '@glimmer/fundamental';

//////////

export const CONSTANT: CONSTANT_REVISION = 0;
export const INITIAL: INITIAL_REVISION = 1;

//////////

const DIRYTABLE_TAG_ID: DirtyableTagId = 0;
const UPDATABLE_TAG_ID: UpdatableTagId = 1;
const CONSTANT_TAG_ID: ConstantTagId = 3;

export const dirtyTag: typeof TagImpl.dirtyTag = TagImpl.dirtyTag;
export const updateTag: typeof TagImpl.update = TagImpl.update;

//////////

export function createTag(): DirtyableTag {
  return new TagImpl(DIRYTABLE_TAG_ID);
}

export function createUpdatableTag(): UpdatableTag {
  return new TagImpl(UPDATABLE_TAG_ID);
}

//////////

export const CONSTANT_TAG: Tag<ConstantTagId> = new TagImpl(CONSTANT_TAG_ID);

//////////

export const CURRENT_TAG: Tag<CurrentTagId> = new TagImpl(101 satisfies CurrentTagId, now);

//////////

// Warm

let tag1 = createUpdatableTag();
let tag2 = createUpdatableTag();
let tag3 = createUpdatableTag();

valueForTag(tag1);
dirtyTag(tag1);
valueForTag(tag1);
updateTag(tag1, combineTags([tag2, tag3]));
valueForTag(tag1);
dirtyTag(tag2);
valueForTag(tag1);
dirtyTag(tag3);
valueForTag(tag1);
updateTag(tag1, tag3);
valueForTag(tag1);
dirtyTag(tag3);
valueForTag(tag1);
