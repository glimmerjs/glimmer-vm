/** @deprecated use ASTv1 instead */
export { ASTv1 as AST } from './lib/-internal';

export {
  b as builders,
  ASTv2,
  ASTv1,
  InvisibleSpan,
  normalize,
  PreprocessOptions,
  Source,
  SourceSlice,
  SourceSpan,
  maybeLoc,
  NON_EXISTENT,
  SymbolTable,
  BlockSymbolTable,
  ProgramSymbolTable,
  GlimmerSyntaxError,
  ASTPluginBuilder,
  SpanList,
  preprocess,
  print,
  HasSourceSpan,
  hasSpan,
  loc,
  MaybeHasSourceSpan,
  ASTPluginEnvironment,
  Syntax,
  Walker,
  traverse,
  cannotRemoveNode,
  cannotReplaceNode,
  WalkerPath,
} from './lib/-internal';

/** @deprecated use WalkerPath instead */
export { WalkerPath as Path } from './lib/-internal';
