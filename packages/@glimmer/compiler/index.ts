export { ProgramSymbols } from './lib/builder/builder';
export { defaultId, precompile, precompileJSON, type PrecompileOptions } from './lib/compiler';

// exported only for tests!
export type { BuilderStatement } from './lib/builder/test-support/builder-interface';
export {
  buildStatement,
  buildStatements,
  c,
  NEWLINE,
  s,
  unicode,
} from './lib/builder/test-support/test-support';
export { default as WireFormatDebugger } from './lib/wire-format-debug';
