import type {
  ResolveAsComponentHeadResolution,
  ResolveAsComponentOrHelperHeadResolution,
  ResolveAsHelperHeadResolution,
  ResolveAsModifierHeadResolution,
  StrictResolution,
} from '@glimmer/interfaces';

export * from './lib/opcodes';

export type VariableResolutionContext =
  | ResolveAsComponentOrHelperHeadResolution
  | ResolveAsHelperHeadResolution
  | ResolveAsComponentHeadResolution
  | ResolveAsModifierHeadResolution
  | StrictResolution;
