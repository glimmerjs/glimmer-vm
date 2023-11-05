import type {
  BlockBoundsDebug,
  Dict,
  Nullable,
  Optional,
  PartialBoundsDebug,
  ScopeSlot,
  SnapshotArray,
  SomeBoundsDebug,
  SomeReactive,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import { readReactive } from '@glimmer/reference';
import { isCompilable, zip } from '@glimmer/util';

import { isReference } from '../utils';
import type { Fragment } from './fragment';
import {
  as,
  dom,
  empty,
  frag,
  group,
  type IntoFragment,
  intoFragment,
  join,
  value,
} from './presets';

export function pick<const T extends object, const K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}

export type As<T> = (value: T) => Fragment;

interface EntriesOptions<T> {
  as?: As<T>;
  subtle?: boolean | undefined | ((value: T) => boolean);
}
function normalizeOptions<T>(options: EntriesOptions<T> | undefined): {
  map: (value: T) => Fragment;
  isSubtle: (value: T) => boolean;
} {
  let isSubtle: (value: T) => boolean;

  const subtleOption = options?.subtle;
  if (typeof subtleOption === 'boolean') {
    isSubtle = () => subtleOption;
  } else if (typeof subtleOption === 'function') {
    isSubtle = subtleOption;
  } else {
    isSubtle = () => false;
  }

  return {
    map: options?.as ?? ((value) => intoFragment(value as IntoFragment)),
    isSubtle,
  };
}
function entries<T>(entries: [string, T][], options?: EntriesOptions<T>): Fragment {
  const { map, isSubtle } = normalizeOptions(options);

  return join(
    entries.map(([k, v]) =>
      isSubtle(v)
        ? frag`${as.subtle(k)}: ${as.subtle(String(v))}`.subtle()
        : frag`${as.kw(k)}: ${map(v)}`
    ),
    ', '
  );
}
export function record(record: Dict<IntoFragment>): Fragment;
export function record<T extends object>(record: T, options: EntriesOptions<T[keyof T]>): Fragment;
export function record(record: Dict<unknown>, options?: EntriesOptions<unknown>): Fragment {
  return wrap('[ ', entries(Object.entries(record), options), ']');
}
export function tuple(record: Dict<IntoFragment>): Fragment;
export function tuple<T extends object>(record: T, options?: EntriesOptions<T[keyof T]>): Fragment;
export function tuple(record: Dict<unknown>, options?: EntriesOptions<unknown>): Fragment {
  return wrap('[ ', entries(Object.entries(record), options), ']');
}
/**
 * The prepend function returns a subtle fragment if the contents are subtle.
 */
export function prepend(before: IntoFragment, contents: Fragment): Fragment {
  return contents.map((f) => frag`${before}${f}`);
}
/**
 * The append function returns a subtle fragment if the contents are subtle.
 */
function append(contents: Fragment, after: IntoFragment): Fragment {
  return contents.map((f) => frag`${f}${after}`);
}
/**
 * The `wrap` function returns a subtle fragment if the contents are subtle.
 */
export function wrap(start: IntoFragment, contents: Fragment, end: IntoFragment) {
  return append(prepend(start, contents), end);
}

export function nullableArray<T>(
  items: Nullable<T[] | readonly T[]>,
  options: EntriesOptions<T>
): Fragment {
  if (items === null) {
    return value(null);
  } else {
    return array(items, options);
  }
}

/**
 * A compact array makes the wrapping `[]` subtle if there's only one element.
 */
export function compactArray<T>(
  items: readonly T[],
  options: EntriesOptions<T> & {
    when: {
      allSubtle: IntoFragment;
      empty?: IntoFragment;
    };
  }
): Fragment {
  const [first] = items;

  if (first === undefined) {
    return options.when?.empty ? intoFragment(options.when.empty) : frag`[]`.subtle();
  }

  const { map, isSubtle } = normalizeOptions(options);

  const contents = items.map((item) => (isSubtle(item) ? frag`${map(item)}`.subtle() : map(item)));
  const body = join(contents, ', ');

  const unsubtle = contents.filter((f) => !f.isSubtle());

  if (unsubtle.length === 0) {
    return intoFragment(options.when.allSubtle).subtle();
  } else if (unsubtle.length === 1) {
    return group(frag`[`.subtle(), body, frag`]`.subtle());
  } else {
    return wrap('[ ', body, ' ]');
  }
}

export function array(items: IntoFragment[]): Fragment;
export function array<T>(items: T[] | readonly T[], options: EntriesOptions<T>): Fragment;
export function array(
  items: unknown[] | readonly unknown[],
  options?: EntriesOptions<unknown>
): Fragment {
  if (items.length === 0) {
    return frag`[]`;
  } else {
    const { map, isSubtle } = normalizeOptions(options);

    const contents = items.map((item) =>
      isSubtle(item) ? frag`${map(item)}`.subtle() : map(item)
    );
    return wrap('[ ', join(contents, ', '), ' ]');
  }
}

function describeRef(ref: SomeReactive): Fragment {
  const label = as.type(String(ref.debugLabel) ?? '');

  if (ref.debug?.isPrimitive) {
    return frag`<${as.kw('ref')} ${label}>`;
  }

  const result = readReactive(ref);

  switch (result.type) {
    case 'err':
      return frag`<${as.error('ref')} ${label} ${as.error('error')}=${value(result.value)}>`;
    case 'ok': {
      return frag`<${as.kw('ref')} ${join([label, value(result.value)], ' ')}>`;
    }
  }
}

export function stackValue(element: unknown): Fragment {
  if (isReference(element)) {
    return describeRef(element);
  } else if (isCompilable(element)) {
    const table = element.symbolTable;

    if ('parameters' in table) {
      const blockParams =
        table.parameters.length === 0
          ? empty()
          : frag` as |${join(
              table.parameters.map((s) => element.meta.debugSymbols?.at(s - 1) ?? `?${s}`),
              ' '
            )}|`;
      return value(element, {
        full: frag`<${as.kw('block')}${blockParams}>`,
        short: 'block',
      });
    } else {
      return frag` <${as.kw('template')} ${element.meta.moduleName ?? '(unknown module)'}>`;
    }
  } else {
    return value(element);
  }
}

export function updatingOpcodes(opcodes: SnapshotArray<UpdatingOpcode>): Fragment {
  return array(opcodes, { as: updatingOpcode });
}

export function updatingOpcode(opcode: UpdatingOpcode): Fragment {
  const name = as.kw(opcode.constructor.name);

  return opcode.debug ? frag`<${name} ${stackValue(opcode.debug)}>` : name;
}

export function scopeValue(element: ScopeSlot): Fragment {
  if (Array.isArray(element)) {
    return frag`<${as.kw('block')}>`;
  } else if (element === null) {
    return value(null);
  } else {
    return stackValue(element);
  }
}

export function bounds(bounds: SomeBoundsDebug): Fragment {
  return bounds.type === 'first' || bounds.type === 'last'
    ? partialBounds(bounds)
    : liveBlock(bounds);
}

export function partialBounds(bounds: PartialBoundsDebug): Fragment {
  return frag`<${as.kw('partial')}:${as.sublabel(bounds.type)} ${dom(bounds.node)}>`;
}

export function liveBlock(element: BlockBoundsDebug): Fragment {
  switch (element.type) {
    case 'empty':
      return frag`<${as.kw('block')} ${as.subtle('(empty)')} ${dom(element.parent)}>`;

    case 'range': {
      if (element.collapsed) {
        return frag`<${as.kw('block')} ${dom(element.range[0])}>`;
      } else {
        return frag`<${as.kw('block')} ${dom(element.range[0])}..${dom(element.range[1])}>`;
      }
    }
  }
}

export function stackChange<T>(
  before: Nullable<SnapshotArray<T>>,
  after: Nullable<SnapshotArray<T>>,
  options: { as: As<T> }
) {
  if (eqStack(before, after)) {
    return frag`${as.subtle('(unchanged)')} ${nullableArray(after, options)}`.subtle();
  }

  return describeDiff(diffStacks(before ?? [], after ?? []), options);
}

export function changeArray<T>(
  a: Nullable<SnapshotArray<T>>,
  b: Nullable<SnapshotArray<T>>,
  {
    eq = Object.is,
    as,
    or = value,
  }: {
    eq?: (a: Nullable<SnapshotArray<T>>, b: Nullable<SnapshotArray<T>>) => boolean;
    as: As<T>;
    or?: As<null | undefined>;
  }
): Fragment {
  if (b === undefined || b === null) {
    return or(b);
  }

  return array(b, { as, subtle: eq(a, b) });
}

export function eqStack<T>(a: Nullable<SnapshotArray<T>>, b: Nullable<SnapshotArray<T>>) {
  if (a === null || b === null) {
    return a === b;
  }

  return a.length === b.length && a.every((a, i) => Object.is(a, b[i]));
}

export function eqStackStack<T>(
  a: Optional<SnapshotArray<SnapshotArray<T>>>,
  b: Optional<SnapshotArray<SnapshotArray<T>>>
) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  return a.length === b.length && a.every((a, i) => eqStack(a, b[i] ?? null));
}

export function diffStacks<T>(
  before: Nullable<readonly T[]>,
  after: Nullable<readonly T[]>,
  eq: (a: T, b: T) => boolean = Object.is
): Diffs<T> {
  if (eqStack(before, after)) {
    return { unused: after ?? [], popped: [], pushed: [], peeked: [] };
  }

  let diverged = false;
  const same: T[] = [];
  const popped: T[] = [];
  const pushed: T[] = [];

  for (const [a, b] of zip(before ?? [], after ?? [])) {
    if (a === undefined || b === undefined) {
      diverged = true;

      if (b === undefined) {
        popped.push(a as T);
      } else {
        pushed.push(b as T);
      }

      continue;
    } else if (diverged || !eq(a, b)) {
      popped.push(a as T);
      pushed.push(b as T);
    } else {
      same.push(b as T);
    }
  }

  return { unused: same, peeked: [], popped, pushed };
}

interface Diffs<T> {
  unused: readonly T[];
  // peeks can only be determined from a spec -- diffs will never produce them.
  peeked: readonly T[];
  popped: readonly T[];
  pushed: readonly T[];
}

export function describeDiff<T>(
  { unused, peeked, pushed, popped }: Diffs<T>,
  options: EntriesOptions<T>
): Fragment {
  return join(
    [
      array(unused, options).subtle(),
      labelled('peeks', compactArray(peeked, { ...options, when: { allSubtle: 'no peeks' } })),
      labelled('pops', compactArray(popped, { ...options, when: { allSubtle: 'no pops' } })),
      labelled('pushes', compactArray(pushed, { ...options, when: { allSubtle: 'no pushes' } })),
    ],
    ' '
  );
}

export function labelled(label: string, value: Fragment): Fragment {
  return prepend(frag`${as.sublabel(label)} `, value);
}
