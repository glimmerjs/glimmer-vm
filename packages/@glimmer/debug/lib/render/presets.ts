import type { Optional, SimpleNode } from '@glimmer/interfaces';

import { Fragment, type LeafFragment } from './fragment';

// inspired by https://github.com/ChromeDevTools/devtools-frontend/blob/c2c17396c9e0da3f1ce6514c3a946f88a06b17f2/front_end/ui/legacy/themeColors.css#L65
export const STYLES = {
  var: 'color: grey',
  varReference: 'color: blue; text-decoration: underline',
  varBinding: 'color: blue;',
  specialVar: 'color: blue',
  prop: 'color: grey',
  specialProp: 'color: red',
  token: 'color: green',
  def: 'color: blue',
  builtin: 'color: blue',
  punct: 'color: grey',
  kw: 'color: rgb(185 0 99 / 100%);',
  type: 'color: teal',
  number: 'color: blue',
  string: 'color: red',
  null: 'color: grey',
  specialString: 'color: darkred',
  atom: 'color: blue',
  attrName: 'color: orange',
  attrValue: 'color: blue',
  comment: 'color: green',
  meta: 'color: grey',
  register: 'color: purple',
  constant: 'color: purple',
  subtle: 'color: lightgrey',
  internals: 'color: lightgrey; font-style: italic',

  sublabel: 'font-style: italic; color: grey',
  error: 'color: red',
  label: 'text-decoration: underline',
  errorLabel: 'color: darkred; font-style: italic',
  errorMessage: 'color: darkred; text-decoration: underline',
  stack: 'color: grey; font-style: italic',
  unbold: 'font-weight: normal',
  pointer: 'background-color: lavender; color: indigo',
  pointee: 'background-color: lavender; color: indigo',
} as const;

export const as = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [
    k,
    (value: IntoFragment) => intoFragment(value).styleAll({ style: v }),
  ])
) as {
  [K in keyof typeof STYLES]: ((value: IntoLeafFragment) => LeafFragment) &
    ((value: IntoFragment) => Fragment);
};

export type Format = { style: string };
export type IntoFormat = { style: string } | keyof typeof STYLES;

export function intoFormat(format: IntoFormat): Format {
  if (typeof format === 'string') {
    return { style: STYLES[format] };
  } else {
    return format;
  }
}

export type IntoFragment = Fragment | IntoFragment[] | number | string | null;
type IntoLeafFragment = LeafFragment | number | string | null;

export function intoFragment(value: IntoFragment): Fragment {
  const fragments = intoFragments(value);
  const [first, ...rest] = fragments;

  if (first !== undefined && rest.length === 0) {
    return first;
  }

  return new Fragment({ kind: 'multi', value: fragments });
}

function intoFragments(value: IntoFragment): LeafFragment[] {
  if (Array.isArray(value)) {
    return value.flatMap(intoFragments);
  } else if (typeof value === 'object' && value !== null) {
    return value.leaves();
  } else {
    return [intoLeafFragment(value)];
  }
}

function intoLeafFragment(value: IntoLeafFragment): LeafFragment {
  if (value === null) {
    return new Fragment({ kind: 'value', value: null });
  } else if (typeof value === 'number') {
    return new Fragment({ kind: 'integer', value });
  } else if (typeof value === 'string') {
    if (/^[\s\p{P}]*$/u.test(value)) {
      return new Fragment({ kind: 'string', value, style: STYLES.punct });
    } else {
      return new Fragment({ kind: 'string', value });
    }
  } else {
    return value;
  }
}

export function plain(string: string): LeafFragment {
  return new Fragment({ kind: 'string', value: string });
}

export function styled(fragment: IntoLeafFragment, format: IntoFormat): LeafFragment;
export function styled(fragment: IntoFragment, format: IntoFormat): Fragment;
export function styled(fragment: IntoFragment, format: IntoFormat): Fragment {
  return intoFragment(fragment).styleAll(format);
}

export function colored({ color, message }: { color: string; message: string }): LeafFragment {
  return new Fragment({ kind: 'string', value: message, style: `color: ${color}` });
}

export function value(
  value: unknown,
  options?: { annotation: string } | { short: string; full: IntoFragment }
): LeafFragment {
  // const annotation = options && 'annotation' in options ? { }

  const normalize = () => {
    if (options === undefined) return;

    if ('annotation' in options) {
      return { compact: options.annotation, full: intoFragment(options.annotation) };
    } else {
      return { compact: options.short, full: intoFragment(options.full) };
    }
  };

  return new Fragment({
    kind: 'value',
    value,
    annotation: normalize(),
  });
}

export function integer(value: number): LeafFragment {
  return new Fragment({ kind: 'integer', value });
}

export function dom(value: Node | SimpleNode): LeafFragment {
  return new Fragment({ kind: 'dom', value });
}

export function empty(): LeafFragment {
  return new Fragment({ kind: 'string', value: '' });
}

export function join(frags: IntoFragment[], separator?: Optional<IntoFragment>): Fragment {
  const sep = separator ? intoFragment(separator) : empty();

  if (frags.length === 0) {
    return empty();
  }

  let seenUnsubtle = false;
  let seenAny = false;

  const output: LeafFragment[] = [];

  for (const frag of frags) {
    const fragment = intoFragment(frag);
    const isSubtle = fragment.isSubtle();
    const sepIsSubtle = isSubtle || !seenUnsubtle;

    // If the succeeding fragment is subtle, the separator is also subtle. If the succeeding
    // fragment is unstubtle, the separator is unsubtle only if we've already seen an unsubtle
    // fragment. This ensures that separators are not ultimately present if the next element is not
    // printed.

    if (seenAny) {
      output.push(...sep.subtle(sepIsSubtle).leaves());
    }

    output.push(...fragment.leaves());
    seenUnsubtle = !isSubtle;
    seenAny = true;
  }

  return new Fragment({ kind: 'multi', value: output });
}

export function group(...frags: IntoFragment[]): Fragment {
  return new Fragment({ kind: 'multi', value: frags.flatMap((f) => intoFragment(f).leaves()) });
}

export function frag(strings: TemplateStringsArray, ...values: IntoFragment[]): Fragment {
  const buffer: LeafFragment[] = [];

  strings.forEach((string, i) => {
    buffer.push(...intoFragment(string).leaves());
    const dynamic = values[i];
    if (dynamic) {
      buffer.push(...intoFragment(dynamic).leaves());
    }
  });

  return new Fragment({ kind: 'multi', value: buffer });
}
