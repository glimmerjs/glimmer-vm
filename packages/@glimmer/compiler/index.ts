export {
  NEWLINE,
  ProgramSymbols,
  buildStatement,
  buildStatements,
  c,
  s,
  unicode,
} from './lib/builder/builder';
export { Builder, type BuilderStatement } from './lib/builder/builder-interface';
export { defaultId, precompile, precompileJSON, type PrecompileOptions } from './lib/compiler';
// exported only for tests!
export { default as WireFormatDebugger } from './lib/wire-format-debug';
