import type {
  HighLevelEnd,
  HighLevelLabel,
  HighLevelResolveComponent,
  HighLevelResolveComponentOrHelper,
  HighLevelResolveFree,
  HighLevelResolveHelper,
  HighLevelResolveLocal,
  HighLevelResolveModifier,
  HighLevelResolveOptionalComponentOrHelper,
  HighLevelResolveOptionalHelper,
  HighLevelResolveTemplateLocal,
  HighLevelStart,
  HighLevelStartLabels,
  HighLevelStopLabels,
} from '@glimmer/interfaces';

export const RESOLVE_MODIFIER: HighLevelResolveModifier = 1003;
export const RESOLVE_COMPONENT: HighLevelResolveComponent = 1004;
export const RESOLVE_HELPER: HighLevelResolveHelper = 1005;
export const RESOLVE_OPTIONAL_HELPER: HighLevelResolveOptionalHelper = 1006;
export const RESOLVE_COMPONENT_OR_HELPER: HighLevelResolveComponentOrHelper = 1007;
export const RESOLVE_OPTIONAL_COMPONENT_OR_HELPER: HighLevelResolveOptionalComponentOrHelper = 1008;
export const RESOLVE_FREE: HighLevelResolveFree = 1009;
export const RESOLVE_LOCAL: HighLevelResolveLocal = 1010;
export const RESOLVE_TEMPLATE_LOCAL: HighLevelResolveTemplateLocal = 1011;

export const HighLevelBuilderOpcodes = {
  Label: 1000 satisfies HighLevelLabel,
  StartLabels: 1001 satisfies HighLevelStartLabels,
  StopLabels: 1002 satisfies HighLevelStopLabels,
  Start: 1000 satisfies HighLevelStart,
  End: 1002 satisfies HighLevelEnd,
} as const;

export const LABEL_OP: HighLevelLabel = 1000;
export const START_LABELS_OP: HighLevelStartLabels = 1001;
export const STOP_LABELS_OP: HighLevelStopLabels = 1002;
export const START_OP: HighLevelStart = 1000;
export const END_OP: HighLevelEnd = 1002;
