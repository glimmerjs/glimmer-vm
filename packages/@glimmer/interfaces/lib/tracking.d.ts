export const STORAGE_SOURCE: unique symbol;
export const CACHE_SOURCE: unique symbol;

export interface CacheSource<T = unknown> {
  [CACHE_SOURCE]: T;
}

export interface StorageSource<T = unknown> {
  [STORAGE_SOURCE]: T;
}

export type Source<T = unknown> = CacheSource<T> | StorageSource<T>;
