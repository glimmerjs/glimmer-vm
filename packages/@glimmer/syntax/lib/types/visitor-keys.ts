import { tuple } from '@glimmer/util';
import * as AST from '../types/nodes';

// ensure stays in sync with typing
// ParentNode and ChildKey types are derived from VisitorKeysMap
const visitorKeys = {
  Program: tuple('body'),
  Template: tuple('body'),
  Block: tuple('body'),

  CommentStatement: tuple(),
  MustacheCommentStatement: tuple(),
  MustacheStatement: tuple('path', 'params', 'hash'),
  MustacheContent: tuple('value'),
  TextNode: tuple(),
  BlockStatement: tuple('path', 'params', 'hash', 'program', 'inverse'),
  ElementModifierStatement: tuple('path', 'params', 'hash'),
  PartialStatement: tuple('name', 'params', 'hash'),
  ElementNode: tuple('attributes', 'modifiers', 'children', 'comments'),
  AttrNode: tuple('value'),

  ConcatStatement: tuple('parts'),
  SubExpression: tuple('path', 'params', 'hash'),
  PathExpression: tuple(),

  LocalReference: tuple(),
  ArgReference: tuple(),
  This: tuple(),
  PathSegment: tuple(),

  StringLiteral: tuple(),
  BooleanLiteral: tuple(),
  NumberLiteral: tuple(),
  NullLiteral: tuple(),
  UndefinedLiteral: tuple(),

  Hash: tuple('pairs'),
  HashPair: tuple('value'),
};

// Program: Program;
// Template: Template;
// Block: Block;
// CommentStatement: CommentStatement;
// MustacheCommentStatement: MustacheCommentStatement;
// TextNode: TextNode;
// PathExpression: PathExpression;
// StringLiteral: StringLiteral;
// BooleanLiteral: BooleanLiteral;
// NumberLiteral: NumberLiteral;
// NullLiteral: NullLiteral;
// UndefinedLiteral: UndefinedLiteral;
// MustacheStatement: MustacheStatement;
// MustacheContent: MustacheContent;
// BlockStatement: BlockStatement;
// ElementModifierStatement: ElementModifierStatement;
// PartialStatement: PartialStatement;
// ElementNode: ElementNode;
// AttrNode: AttrNode;
// ConcatStatement: ConcatStatement;
// SubExpression: SubExpression;
// Hash: Hash;
// HashPair: HashPair;
// LocalReference: LocalReference;
// ArgReference: ArgReference;
// This: This;
// PathSegment: PathSegment;

type VisitorKeysMap = typeof visitorKeys;

export type VisitorKeys = { [P in keyof VisitorKeysMap]: VisitorKeysMap[P][number] };
export type VisitorKey<N extends AST.Node> = VisitorKeys[N['type']] & keyof N;

export default visitorKeys;
