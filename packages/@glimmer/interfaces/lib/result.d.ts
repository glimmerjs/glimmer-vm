export interface OkResult<T> {
  type: 'ok';
  value: T;
}

export interface ErrResult {
  type: 'err';
  value: unknown;
}

export type Result<T> = OkResult<T> | ErrResult;
