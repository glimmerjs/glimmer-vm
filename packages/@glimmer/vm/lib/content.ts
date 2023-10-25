export const COMPONENT_CONTENT = 0;
export type COMPONENT_CONTENT = typeof COMPONENT_CONTENT;
export const HELPER_CONTENT = 1;
export type HELPER_CONTENT = typeof HELPER_CONTENT;
export const STRING_CONTENT = 2;
export type STRING_CONTENT = typeof STRING_CONTENT;
export const EMPTY_CONTENT = 3;
export type EMPTY_CONTENT = typeof EMPTY_CONTENT;
export const SAFE_STRING_CONTENT = 4;
export type SAFE_STRING_CONTENT = typeof SAFE_STRING_CONTENT;
export const FRAGMENT_CONTENT = 5;
export type FRAGMENT_CONTENT = typeof FRAGMENT_CONTENT;
export const NODE_CONTENT = 6;
export type NODE_CONTENT = typeof NODE_CONTENT;
export const OTHER_CONTENT = 8;
export type OTHER_CONTENT = typeof OTHER_CONTENT;

interface ContentTypeMap {
  Component: COMPONENT_CONTENT;
  Helper: HELPER_CONTENT;
  String: STRING_CONTENT;
  Empty: EMPTY_CONTENT;
  SafeString: SAFE_STRING_CONTENT;
  Fragment: FRAGMENT_CONTENT;
  Node: NODE_CONTENT;
  Other: OTHER_CONTENT;
}

export type ContentTypeName = keyof ContentTypeMap;

export type ContentType<K extends ContentTypeName = ContentTypeName> = ContentTypeMap[K];
export type DynamicContentType = COMPONENT_CONTENT | HELPER_CONTENT | STRING_CONTENT;
