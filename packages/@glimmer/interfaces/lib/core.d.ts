export type Present = {} | void;
export type Opaque = Present | null | undefined;
export type Option<T> = T | null;
export type Maybe<T> = Option<T> | undefined | void;
export type FIXME<T, S extends string> = T;
export type unsafe = any;

export interface Dict<T = unknown> {
  [key: string]: T;
}

export interface Indexable {
  [key: string]: unknown;
}

// `UserValue` represents the fact that any JavaScript value other
// than null or undefined is actually indexable. In normal
// circumstances, we don't want to index anything, but sometimes
// we want to index blindly into user values.
export type UserValue = Indexable | null | undefined;

export interface Unique<T> {
  'Unique [id=ada0f31f-27f7-4ab0-bc03-0005387c9d5f]': T;
}

export type Recast<T, U> = (T & U) | U;
