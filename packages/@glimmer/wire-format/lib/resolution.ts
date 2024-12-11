import type {
  ResolveAsComponentHeadResolution,
  ResolveAsComponentOrHelperHeadResolution,
  ResolveAsHelperHeadResolution,
  ResolveAsModifierHeadResolution,
  StrictResolution,
} from '@glimmer/interfaces';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type resolution =
  | ResolveAsComponentOrHelperHeadResolution
  | ResolveAsHelperHeadResolution
  | ResolveAsComponentHeadResolution
  | ResolveAsModifierHeadResolution
  | StrictResolution;

export const resolution: {
  readonly Strict: StrictResolution;
  readonly ResolveAsComponentOrHelperHead: ResolveAsComponentOrHelperHeadResolution;
  readonly ResolveAsHelperHead: ResolveAsHelperHeadResolution;
  readonly ResolveAsModifierHead: ResolveAsModifierHeadResolution;
  readonly ResolveAsComponentHead: ResolveAsComponentHeadResolution;
} = {
  Strict: 0,
  ResolveAsComponentOrHelperHead: 1,
  ResolveAsHelperHead: 5,
  ResolveAsModifierHead: 6,
  ResolveAsComponentHead: 7,
} as const;
