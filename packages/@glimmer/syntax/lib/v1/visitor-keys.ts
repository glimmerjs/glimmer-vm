import type * as ASTv1 from './api';

// ensure stays in sync with typing
// ParentNode and ChildKey types are derived from VisitorKeysMap
const visitorKeys = {
  Template: ['body'],
  Block: ['body'],

  MustacheStatement: ['path', 'params', 'hash'],
  BlockStatement: ['path', 'params', 'hash', 'program', 'inverse'],
  ElementModifierStatement: ['path', 'params', 'hash'],
  CommentStatement: [],
  MustacheCommentStatement: [],
  ElementNode: ['attributes', 'modifiers', 'children', 'comments'],
  AttrNode: ['value'],
  TextNode: [],

  ConcatStatement: ['parts'],
  SubExpression: ['path', 'params', 'hash'],
  PathExpression: [],

  StringLiteral: [],
  BooleanLiteral: [],
  NumberLiteral: [],
  NullLiteral: [],
  UndefinedLiteral: [],

  Hash: ['pairs'],
  HashPair: ['value'],
} as const;

type VisitorKeysMap = typeof visitorKeys;

export type VisitorKeys = { [P in keyof VisitorKeysMap]: VisitorKeysMap[P][number] };
export type VisitorKey<N extends ASTv1.Node> = VisitorKeys[N['type']] & keyof N;

export default visitorKeys;
