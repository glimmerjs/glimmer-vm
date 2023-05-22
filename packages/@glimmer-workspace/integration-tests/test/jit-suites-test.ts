import {
  DebuggerSuite,
  EachSuite,
  InElementSuite,
  jitComponentSuite,
  jitSuite,
  TemplateOnlyComponents,
} from '@glimmer-workspace/integration-tests';

jitSuite(DebuggerSuite);
jitSuite(EachSuite);
jitSuite(InElementSuite);

// jitComponentSuite(GlimmerishComponents);
jitComponentSuite(TemplateOnlyComponents);
// jitComponentSuite(EmberishComponentTests);
// jitComponentSuite(HasBlockSuite);
// jitComponentSuite(HasBlockParametersHelperSuite);
// jitComponentSuite(ScopeSuite);
// jitComponentSuite(ShadowingSuite);
// jitComponentSuite(WithDynamicVariablesSuite);
// jitComponentSuite(YieldSuite);
