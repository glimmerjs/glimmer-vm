import {
  ErrorRecoveryRenderDelegate,
  JitRenderDelegate,
} from '@glimmer-workspace/integration-tests';

import { DynamicInitialRenderSuite } from './dynamic';
import { InitialRenderTests } from './static';

InitialRenderTests({
  template: 'all',
  delegates: [JitRenderDelegate, ErrorRecoveryRenderDelegate],
});

export { DynamicInitialRenderSuite, InitialRenderTests };
