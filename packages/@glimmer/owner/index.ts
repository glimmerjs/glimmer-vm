const OWNER = /*@__PURE__*/ new WeakMap<object, object>();

/**
  Framework objects in a Glimmer application may receive an owner object.
  Glimmer is unopinionated about `this owner, but will forward it through its
  internal resolution system, and through its managers if it is provided.
*/

export const getOwner = /*@__PURE__ */ OWNER.get.bind(OWNER) as <O extends object = object>(
  object: object
) => O | undefined;

/**
  `setOwner` set's an object's owner
*/
export const setOwner = /**@__PURE__ */ OWNER.set.bind(OWNER) as <O extends object = object>(
  object: object,
  owner: O
) => void;
