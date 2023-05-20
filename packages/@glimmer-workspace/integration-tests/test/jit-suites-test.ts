import {
  DebuggerSuite,
  EachSuite,
  EmberishComponentTests,
  GlimmerishComponents,
  HasBlockParamsHelperSuite as HasBlockParametersHelperSuite,
  HasBlockSuite,
  InElementSuite,
  jitComponentSuite,
  jitSuite,
  ScopeSuite,
  ShadowingSuite,
  TemplateOnlyComponents,
  WithDynamicVarsSuite as WithDynamicVariablesSuite,
  YieldSuite,
} from '..';

jitSuite(DebuggerSuite);
jitSuite(EachSuite);
jitSuite(InElementSuite);

jitComponentSuite(GlimmerishComponents);
jitComponentSuite(TemplateOnlyComponents);
jitComponentSuite(EmberishComponentTests);
jitComponentSuite(HasBlockSuite);
jitComponentSuite(HasBlockParametersHelperSuite);
jitComponentSuite(ScopeSuite);
jitComponentSuite(ShadowingSuite);
jitComponentSuite(WithDynamicVariablesSuite);
jitComponentSuite(YieldSuite);
