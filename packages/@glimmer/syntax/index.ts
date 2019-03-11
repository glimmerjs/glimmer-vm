// used by ember-compiler
export * from './lib/hbs/pos';
export * from './lib/hbs/builder';

import * as builder from './lib/hbs/builder';
export { builder };

// needed for tests only
export {
  default as TraversalError,
  cannotRemoveNode,
  cannotReplaceNode,
  cannotReplaceOrRemoveInKeyHandlerYet,
} from './lib/traversal/errors';
export { default as traverse } from './lib/traversal/traverse';
export * from './lib/traversal/visitor';
export { default as Walker } from './lib/traversal/walker';

// errors
export { default as SyntaxError } from './lib/errors/syntax-error';

// AST
import * as AST from './lib/types/nodes';
export { AST };
export { isLiteral, printLiteral } from './lib/utils';

import * as hbs from './lib/types/handlebars-ast';
export { hbs };

export * from './lib/hbs/parse';
export * from './lib/hbs/parse/html';
export * from './lib/hbs/debug-span';

export type TODO = any;

export const preprocess: TODO = function() {
  throw new Error('unimplemented preprocess');
};

export type Syntax = TODO;
export type ASTPluginBuilder = TODO;
export type ASTPluginEnvironment = TODO;

export const ASTPluginBuilder: ASTPluginBuilder = function() {
  throw new Error('unimplemented ASTPluginBuilder');
};

export const print: TODO = function() {
  throw new Error('unimplemented print');
};

export const voidMap: TODO = null;
export type PreprocessOptions = TODO;
