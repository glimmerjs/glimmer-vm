import type { Dict, LiveBlockDebug, Maybe, Reference, ScopeSlot } from '@glimmer/interfaces';
import { tryValueForRef } from '@glimmer/reference/lib/reference';
import { isCompilable, zip } from '@glimmer/util';

import { isReference } from '../utils';
import type { Fragment } from './fragment';
import { as, dom, empty, frag, type IntoFragment, intoFragment, join, value } from './presets';

export function pick<const T extends object, const K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}
interface EntriesOptions<T> {
  as?: (value: T) => Fragment;
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
function wrap(start: IntoFragment, contents: Fragment, end: IntoFragment) {
  return append(prepend(start, contents), end);
}

export function array(items: IntoFragment[]): Fragment;
export function array<T>(items: T[] | readonly T[], options: EntriesOptions<T>): Fragment;
export function array(
  items: unknown[] | readonly unknown[],
  options?: EntriesOptions<unknown>
): Fragment {
  if (items.length === 0) {
    return frag`[]`.subtle();
  } else {
    const { map, isSubtle } = normalizeOptions(options);

    const contents = items.map((item) =>
      isSubtle(item) ? frag`${map(item)}`.subtle() : map(item)
    );
    return wrap('[ ', join(contents, ', '), ' ]');
  }
}

function describeRef(ref: Reference): Fragment {
  const label = as.type(String(ref.debugLabel) ?? '');

  if (ref.debug?.isPrimitive) {
    return frag`<${as.kw('ref')} ${label}>`;
  }

  const result = tryValueForRef(ref);

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

export function scopeValue(element: ScopeSlot): Fragment {
  if (Array.isArray(element)) {
    return frag`<${as.kw('block')}>`;
  } else if (element === null) {
    return value(null);
  } else {
    return stackValue(element);
  }
}

export function liveBlock(element: LiveBlockDebug): Fragment {
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

export function eqStack<T>(a: Maybe<readonly T[]>, b: Maybe<readonly T[]>) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  return a.length === b.length && a.every((a, i) => Object.is(a, b[i]));
}

export function diffStacks<T>(before: readonly T[], after: readonly T[]): Diffs<T> {
  if (eqStack(before, after)) {
    return { unused: after, popped: [], pushed: [], peeked: [] };
  }

  let diverged = false;
  const same: T[] = [];
  const popped: T[] = [];
  const pushed: T[] = [];

  for (const [a, b] of zip(before, after)) {
    if (a === undefined || b === undefined) {
      diverged = true;

      if (b === undefined) {
        popped.push(a as T);
      } else {
        pushed.push(b as T);
      }

      continue;
    } else if (diverged || !Object.is(a, b)) {
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
  // peeks can only be determined from a spec -- diffs will
  // never produce them.
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
      prepend(frag`${as.sublabel('peeks')} `, array(peeked, options)),
      prepend(frag`${as.sublabel('pops')} `, array(popped, options)),
      prepend(frag`${as.sublabel('pushes')} `, array(pushed, options)),
    ],
    ' '
  );
}
