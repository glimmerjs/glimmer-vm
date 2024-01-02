import type { ComponentKind } from '../components';

export const KIND_FOR = {
  glimmer: 'Glimmer',
  curly: 'Curly',
  dynamic: 'Dynamic',
  templateOnly: 'TemplateOnly',
} as const;

export type KindFor<K extends DeclaredComponentType> = (typeof KIND_FOR)[K];
export type DeclaredComponentType = 'glimmer' | 'curly' | 'dynamic' | 'templateOnly';
export type EveryComponentType = DeclaredComponentType | 'all';

export const TYPE_FOR = {
  Glimmer: 'glimmer',
  Curly: 'curly',
  Dynamic: 'dynamic',
  TemplateOnly: 'templateOnly',
} as const;

export type TypeFor<K extends ComponentKind> = (typeof TYPE_FOR)[K];
