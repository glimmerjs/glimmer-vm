import type { Described, Description, Reactive } from '@glimmer/interfaces';
import {
  devmode,
  enhancedDevmode,
  inDevmode,
  stringifyChildLabel,
  stringifyDebugLabel,
} from '@glimmer/util';

export function getChildLabel(parent: Described<Description>, child: PropertyKey) {
  if (import.meta.env.DEV) {
    return stringifyChildLabel(...inDevmode(parent.description).label, child as string | symbol);
  } else {
    return String(child);
  }
}

export const describeReactive = enhancedDevmode(
  () => {
    return '{reactive value}';
  },
  (reactive: Reactive) => {
    const description = inDevmode(reactive.description);

    const types = inDevmode(TYPE_NAMES);
    const desc =
      description.type in types ? types[description.type as keyof typeof types] : 'reference';

    return description.label ? `${desc} (\`${stringifyDebugLabel(reactive)}\`)` : desc;
  }
);

const TYPE_NAMES = devmode(() => ({
  ReadonlyCell: 'readonly cell',
  MutableCell: 'mutable cell',
  DeeplyReadonlyCell: 'deeply readonly cell',
  InfallibleFormula: 'infallible formula',
  FallibleFormula: 'fallible formula',
  Accessor: 'accessor',
  GetProperty: 'property reference',
  ConstantError: 'constant error',
}));
