// used by ember-compiler
export {
  preprocess,
  PreprocessOptions,
  ASTPlugin,
  ASTPluginBuilder,
  ASTPluginEnvironment,
  Syntax,
} from './lib/parser/tokenizer-event-handlers';

export { SourceLocation, Position as SourcePosition } from './lib/types/nodes-v1';

// needed for tests only
export { default as builders, SYNTHETIC } from './lib/v1-builders';
export {
  default as TraversalError,
  cannotRemoveNode,
  cannotReplaceNode,
  cannotReplaceOrRemoveInKeyHandlerYet,
} from './lib/traversal/errors';
export { default as traverse } from './lib/traversal/traverse';
export * from './lib/traversal/visitor';
export { default as Path } from './lib/traversal/path';
export { default as Walker } from './lib/traversal/walker';
export { default as print } from './lib/generation/print';

// errors
export { GlimmerSyntaxError } from './lib/errors/syntax-error';

// AST
import * as AST from './lib/types/nodes-v1';
/** @deprecated use ASTv2 instead */
export { AST, AST as ASTv1 };
export { isLiteral, printLiteral } from './lib/utils';

import * as ASTv2 from './lib/types/nodes-v2';
export { ASTv2 };

export * from './lib/symbol-table';
export { normalize } from './lib/normalize';
