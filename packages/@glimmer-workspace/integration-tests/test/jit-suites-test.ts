import {
  DebuggerSuite,
  EachSuite,
  ElementHelperTest,
  ElementHelperStrictModeTest,
  EmberishComponentTests,
  GlimmerishComponents,
  HasBlockParamsHelperSuite,
  HasBlockSuite,
  InElementSuite,
  jitComponentSuite,
  jitSuite,
  ScopeSuite,
  ShadowingSuite,
  TemplateOnlyComponents,
  WithDynamicVarsSuite,
  YieldSuite,
} from '@glimmer-workspace/integration-tests';

jitComponentSuite(DebuggerSuite);
jitSuite(EachSuite);
jitSuite(InElementSuite);
jitSuite(ElementHelperTest);
jitSuite(ElementHelperStrictModeTest);

jitComponentSuite(GlimmerishComponents);
jitComponentSuite(TemplateOnlyComponents);
jitComponentSuite(EmberishComponentTests);
jitComponentSuite(HasBlockSuite);
jitComponentSuite(HasBlockParamsHelperSuite);
jitComponentSuite(ScopeSuite);
jitComponentSuite(ShadowingSuite);
jitComponentSuite(WithDynamicVarsSuite);
jitComponentSuite(YieldSuite);
