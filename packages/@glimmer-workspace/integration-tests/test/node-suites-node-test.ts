import {
  CompilationTests,
  DOMHelperTests,
  JitSerializationDelegate,
  nodeComponentSuite,
  NodeJitRenderDelegate,
  nodeSuite,
  SerializedDOMHelperTests,
  ServerSideComponentSuite,
  ServerSideSuite,
  testSuite,
} from '../lib';

nodeSuite(ServerSideSuite);
nodeComponentSuite(ServerSideComponentSuite);

testSuite(DOMHelperTests, NodeJitRenderDelegate);
testSuite(SerializedDOMHelperTests, JitSerializationDelegate);

if (typeof process !== 'undefined') {
  testSuite(CompilationTests, NodeJitRenderDelegate);
}
