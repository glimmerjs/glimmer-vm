import type {
  ATag,
  ClassAttr,
  DivTag,
  HrefAttr,
  IdAttr,
  NameAttr,
  PTag,
  SpanTag,
  StyleAttr,
  TypeAttr,
  ValueAttr,
} from '@glimmer/interfaces';

export const WellKnownAttrNames: {
  readonly class: ClassAttr;
  readonly id: IdAttr;
  readonly value: ValueAttr;
  readonly name: NameAttr;
  readonly type: TypeAttr;
  readonly style: StyleAttr;
  readonly href: HrefAttr;
} = {
  class: 0,
  id: 1,
  value: 2,
  name: 3,
  type: 4,
  style: 5,
  href: 6,
} as const;

export const WellKnownTagNames: {
  readonly div: DivTag;
  readonly span: SpanTag;
  readonly p: PTag;
  readonly a: ATag;
} = {
  div: 0,
  span: 1,
  p: 2,
  a: 3,
} as const;
