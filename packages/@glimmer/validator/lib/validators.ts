import type {
  CONSTANT_REVISION,
  ConstantTag,
  ConstantTagId,
  CurrentTagId,
  DirtyableTag,
  DirtyableTagId,
  INITIAL_REVISION,
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

export const DIRTY_TAG = TagImpl.dirtyTag;
export const UPDATE_TAG = TagImpl.update;

//////////

export function createTag(): DirtyableTag {
  return new TagImpl(DIRYTABLE_TAG_ID);
}

export function createUpdatableTag(): UpdatableTag {
  return new TagImpl(UPDATABLE_TAG_ID);
}

//////////

export const CONSTANT_TAG: ConstantTag = new TagImpl(CONSTANT_TAG_ID);

//////////

export const CURRENT_TAG = new TagImpl(101 satisfies CurrentTagId, now);

//////////

// Warm

let tag1 = createUpdatableTag();
let tag2 = createUpdatableTag();
let tag3 = createUpdatableTag();

valueForTag(tag1);
DIRTY_TAG(tag1);
valueForTag(tag1);
UPDATE_TAG(tag1, combineTags([tag2, tag3]));
valueForTag(tag1);
DIRTY_TAG(tag2);
valueForTag(tag1);
DIRTY_TAG(tag3);
valueForTag(tag1);
UPDATE_TAG(tag1, tag3);
valueForTag(tag1);
DIRTY_TAG(tag3);
valueForTag(tag1);
