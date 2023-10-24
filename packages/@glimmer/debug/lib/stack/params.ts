import type { Dict, Expand, VM } from '@glimmer/interfaces';
import { REFERENCE, type Reference } from '@glimmer/reference';
import { enumerate, isObject } from '@glimmer/util';

export const UNCHANGED = Symbol('UNCHANGED');

type ErrorInfo =
  | { type: 'record'; errors: Record<string, ErrorInfo> }
  | { type: 'list'; errors: Record<number, ErrorInfo> }
  | { type: 'leaf'; expected: string };

type CoerceResult<T> = ['ok', T] | [status: 'fail', aggregate: ErrorInfo];

type LazyStackType<T, Default extends string> =
  | (<N extends string>(name: N) => StackType<N | Default, T>)
  | (() => StackType<Default, T>);

const Ok = <T>(value: T): CoerceResult<T> => ['ok', value];
const Fail = <T>(expected: string): CoerceResult<T> => ['fail', { type: 'leaf', expected }];

interface StackType<N extends string, T> {
  readonly name: N;
  coerce: Coerce<T>;
}

function def<N extends string, T>(name: N, coerce: Coerce<T>): StackType<N, T> {
  return {
    name,
    coerce,
  };
}

type Coerce<T> = (item: unknown, vm: VM) => CoerceResult<T>;

function define<const T extends Record<string, <N extends string>(name: N) => StackType<N, any>>>(
  types: T
): Expand<{
  [N in Extract<keyof T, string>]: StackType<
    N,
    T[N] extends LazyStackType<infer U, any> ? U : T[N]
  >;
}> {
  return Object.entries(types).reduce(
    (acc, [name, build]) => ({
      ...acc,
      [name]: build(name),
    }),
    {}
  ) as any;
}

const IsReference = {
  name: 'reference',
  coerce: (value) => {
    return isObject(value) && REFERENCE in value ? Ok(value as Reference) : Fail('reference');
  },
} satisfies StackType<'reference', Reference>;

const types = define({
  'imm/bool': pipe(isBool, (value) => !!value),
  'imm/i32': coerce(isI32),

  args: instance(Object),
  'args/captured': IsInterface({
    positional: IsArray(IsReference),
    named: IsDict(IsReference),
  }),
});

function IsArray<N extends string, T>(kind: StackType<N, T>): LazyStackType<T[], `${N}[]`> {
  return () => ({
    name: `${kind.name}[]` as const,
    coerce: (value: unknown, vm: VM): CoerceResult<T[]> => {
      let errors: Record<number, ErrorInfo> = {};

      if (!Array.isArray(value)) {
        return Fail(`${kind.name}[]`);
      }

      for (let [i, item] of enumerate(value)) {
        let result = kind.coerce(item, vm);
        if (result[0] === 'fail') {
          errors[i] = result[1];
        }
      }

      if (Object.keys(errors).length > 0) {
        return ['fail', { type: 'list', errors }];
      } else {
        return Ok(value as T[]);
      }
    },
  });
}

function IsDict<N extends string, T>(kind: StackType<N, T>): LazyStackType<Dict<T>, `Dict<${N}>`> {
  return () => ({
    name: `Dict<${kind.name}>` as const,
    coerce: (value: unknown, vm: VM): CoerceResult<Dict<T>> => {
      let errors: Record<string, ErrorInfo> = {};

      if (!isObject(value)) {
        return Fail(`Dict<${kind.name}>`);
      }

      for (let [key, item] of Object.entries(value)) {
        let result = kind.coerce(item, vm);
        if (result[0] === 'fail') {
          errors[key] = result[1];
        }
      }

      if (Object.keys(errors).length > 0) {
        return ['fail', { type: 'list', errors }];
      } else {
        return Ok(value as Dict<T>);
      }
    },
  });
}

function pipe<T, U = T>(
  check: (value: unknown) => value is T,
  then: (value: T) => U = (value: T) => value as unknown as U
): LazyStackType<U, never> {
  return (name) => ({
    name,
    coerce: (value) => {
      if (check(value)) {
        return Ok(then(value));
      } else {
        return Fail(name);
      }
    },
  });
}

function coerce<T>(check: (value: unknown) => value is T): LazyStackType<T, never> {
  return (name) => ({
    name,
    coerce: (value) => {
      if (check(value)) {
        return Ok(value);
      } else {
        return Fail(name);
      }
    },
  });
}

function instance<T>(Class: abstract new (...args: any[]) => T): LazyStackType<T, never> {
  return (name) => ({
    name,
    coerce: (item) => (item instanceof Class ? Ok(item) : Fail(`instanceof ${Class.name}`)),
  });
}

type GetInterface<R extends Record<string, LazyStackType<any, any>>> = Expand<{
  [K in keyof R]: ReturnType<R[K]>;
}>;

function IsInterface<R extends Record<string, LazyStackType<any, any>>>(
  record: R
): LazyStackType<GetInterface<R>, never> {
  return (name) => ({
    name,
    coerce: (item, vm) => {
      let errors: Record<string, ErrorInfo> = {};

      for (let [key, type] of Object.entries(record)) {
        let [result, err] = type(key).coerce(item, vm);

        if (result === 'fail') {
          errors[key] = err;
        }
      }

      if (Object.keys(errors).length > 0) {
        return ['fail', { type: 'record', errors }];
      } else {
        return Ok(item as GetInterface<R>);
      }
    },
  });

  function check(item: unknown, vm: VM): item is GetInterface<R> {
    return Object.entries(record).every(([name, type]) => {
      const [result] = type(name).coerce(item, vm);
      return result === 'ok';
    });
  }

  return check as any;
}

function isBool(value: unknown): value is boolean {
  return value === 0 || value === 1;
}

function isI32(value: unknown): value is number {
  return typeof value === 'number' && value <= 0x7fffffff;
}

// @note STACK_TYPES
export const STACK_TYPES = [
  'block/template',
  'block/invocation',
  // a block is a pair of [block/table, block/handle]
  'block/table',
  'block/handle',
  'block/table?',
  'block/handle?',

  'component/definition',
  'component/%definition',
  'component/%value',
  'component/instance',

  // either a block or program table
  'table',
  'scope',
  'bool',

  'args',
  'args/captured',

  // $pc or $ra
  'register/instruction',
  // $sp or $fp
  'register/stack',

  'reference/bool',
  'reference/any',
  'reference/fn',
  'reference/definition',

  'i32',
  'i32/todo',

  /**
   * {@linkcode ContentType | Content Type Enum}
   */
  'enum/ctype',

  'glimmer/iterator',

  'value/dynamic',
  'value/str',

  UNCHANGED,
] as const;
