import { SmokeTests, jitSuite, aotSuite, nodeSuite } from '@glimmer/integration-tests';

jitSuite(SmokeTests);
aotSuite(SmokeTests);
nodeSuite(SmokeTests);
