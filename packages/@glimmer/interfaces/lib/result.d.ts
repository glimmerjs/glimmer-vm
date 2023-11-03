export interface OkResult<T> {
  type: 'ok';
  value: T;
}

export interface ErrResult<E = unknown> {
  type: 'err';
  value: E;
}

export type Result<T, E = unknown> = { type: 'ok'; value: T } | { type: 'err'; value: E };
