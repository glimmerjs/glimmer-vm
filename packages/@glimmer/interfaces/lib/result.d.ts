export interface OkResult<T> {
  type: 'ok';
  value: T;
}

export interface ErrResult<E = unknown> {
  type: 'err';
  value: E;
}

export type Result<T, E = unknown> = { type: 'ok'; value: T } | { type: 'err'; value: E };
export type Unwrap<R extends Result<unknown>> = R extends Result<infer T> ? T : never;
export type UnwrapN<R extends Result<unknown> | readonly Result<unknown>[]> = R extends Result<
  infer T
>
  ? T
  : R extends readonly Result<unknown>[]
  ? { [K in keyof R & number]: Unwrap<R[K]> }
  : never;
