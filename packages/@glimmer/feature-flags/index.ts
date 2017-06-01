declare const process: Object;
export const INCLUDE_PARTIALS = true;
export const INCLUDE_WITH_DYNAMIC_SCOPE = true;
export const INCLUDE_LEGACY = true;

export const APPLY_TEXT_NODE_MERGING = true;
export const APPLY_TABLE_FIXES = true;

// Used to remove node specific code
export const APPLY_DOM_PATCHES = (() => typeof process === 'undefined')();
