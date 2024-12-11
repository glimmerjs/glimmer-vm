import type {
  HighLevelEnd,
  HighLevelLabel,
  HighLevelResolveComponent,
  HighLevelResolveComponentOrHelper,
  HighLevelResolveHelper,
  HighLevelResolveLocal,
  HighLevelResolveModifier,
  HighLevelResolveOptionalComponentOrHelper,
  HighLevelResolveTemplateLocal,
  HighLevelStart,
  HighLevelStartLabels,
  HighLevelStopLabels,
} from '@glimmer/interfaces';

export const HighLevelResolutionOpcodes: {
  readonly Modifier: HighLevelResolveModifier;
  readonly Component: HighLevelResolveComponent;
  readonly Helper: HighLevelResolveHelper;
  readonly ComponentOrHelper: HighLevelResolveComponentOrHelper;
  readonly OptionalComponentOrHelper: HighLevelResolveOptionalComponentOrHelper;
  readonly Local: HighLevelResolveLocal;
  readonly TemplateLocal: HighLevelResolveTemplateLocal;
} = {
  Modifier: 1003,
  Component: 1004,
  Helper: 1005,
  ComponentOrHelper: 1007,
  OptionalComponentOrHelper: 1008,
  Local: 1010,
  TemplateLocal: 1011,
} as const;

export const HighLevelBuilderOpcodes: {
  readonly Label: HighLevelLabel;
  readonly StartLabels: HighLevelStartLabels;
  readonly StopLabels: HighLevelStopLabels;
  readonly Start: HighLevelStart;
  readonly End: HighLevelEnd;
} = {
  Label: 1000,
  StartLabels: 1001,
  StopLabels: 1002,
  Start: 1000,
  End: 1002,
} as const;
