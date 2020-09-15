import { ASTv2 } from '@glimmer/syntax';
import { unreachable } from '@glimmer/util';
import { Result } from '../../../shared/result';
import { Source } from '../../../source/source';
import { VisitorContext } from '../context';

export type KeywordPath<
  Types extends PossibleNodeType,
  S extends string
> = Types extends 'PathExpression'
  ? ASTv2.PathExpression & {
      original: S;
    }
  : never;

export type KeywordCall<Types extends PossibleNodeType, S extends string> = ASTv2.Nodes[Types] & {
  head: KeywordPath<'PathExpression', S>;
};

export type KeywordNode<Types extends PossibleNodeType, S extends string> =
  | KeywordCall<Types, S>
  | KeywordPath<Types, S>;

export type PossibleMatch<
  NodeType extends keyof KeywordTypes
> = ASTv2.Nodes[KeywordTypes[NodeType]];
export type Match<NodeType extends keyof KeywordTypes, S extends string = string> = KeywordNode<
  KeywordTypes[NodeType],
  S
>;

interface KeywordDelegate<S extends string, NodeType extends keyof KeywordTypes, V, Out> {
  assert(options: PossibleMatch<NodeType>, source: Source): V;
  translate(options: Match<NodeType, S>, ctx: VisitorContext, param: V): Result<Out>;
}

export interface Keyword<
  S extends string = string,
  Out = unknown,
  KeywordType extends keyof KeywordTypes = keyof KeywordTypes
> {
  match(
    node: ASTv2.Node | KeywordNode<KeywordTypes[KeywordType], S>
  ): node is KeywordNode<KeywordTypes[KeywordType], S>;
  translate(node: Match<KeywordType, S>, ctx: VisitorContext): Result<Out>;
}

class KeywordImpl<
  KeywordType extends keyof KeywordTypes,
  S extends string = string,
  Param = unknown,
  Out = unknown
> implements Keyword<S, Out, KeywordType> {
  private types: Set<keyof ASTv2.Nodes>;

  constructor(
    private keyword: S,
    type: KeywordType,
    private delegate: KeywordDelegate<S, KeywordType, Param, Out>
  ) {
    let nodes = new Set<keyof ASTv2.Nodes>();
    for (let nodeType of KEYWORD_NODES[type]) {
      nodes.add(nodeType);
    }

    this.types = nodes;
  }

  match(
    node: ASTv2.Node | KeywordNode<KeywordTypes[KeywordType], S>
  ): node is KeywordNode<KeywordTypes[KeywordType], S> {
    if (!this.types.has(node.type)) {
      return false;
    }

    let path = getPathExpression(node);

    if (typeof path === 'string') {
      return false;
    } else if (path.head.type === 'FreeVarHead') {
      return path.head.name === this.keyword;
    } else {
      return false;
    }
  }

  translate(node: Match<KeywordType, S>, ctx: VisitorContext): Result<Out> {
    let param = this.delegate.assert(node as PossibleMatch<KeywordType>, ctx.utils.source);
    return this.delegate.translate(node, ctx, param);
  }
}

export type PossibleNodeType = 'PathExpression' | ASTv2.CallNode['type'];

export const KEYWORD_NODES = {
  Expr: ['SubExpression', 'PathExpression'],
  Block: ['BlockStatement'],
  Append: ['AppendStatement'],
} as const;

export type ExprKeywordNode = ASTv2.SubExpression | ASTv2.PathExpression;

/**
 * A "generic" keyword is something like `has-block`, which makes sense in the context
 * of sub-expression, path, or append
 */
export type GenericKeywordNode = ASTv2.AppendStatement | ASTv2.SubExpression | ASTv2.PathExpression;

export type KeywordTypeLists = {
  [P in keyof typeof KEYWORD_NODES]: typeof KEYWORD_NODES[P];
};

export type KeywordTypes = {
  [P in keyof typeof KEYWORD_NODES]: typeof KEYWORD_NODES[P][number];
};

export type KeywordTypeName = keyof KeywordTypes;
export type KeywordType = KeywordTypes[KeywordTypeName];

export function keyword<
  KeywordType extends keyof KeywordTypes,
  S extends string = string,
  Out = unknown
>(
  keyword: S,
  types: KeywordType,
  delegate: KeywordDelegate<S, KeywordType, unknown, Out>
): Keyword<S, Out, KeywordType> {
  return new KeywordImpl(keyword, types, delegate);
}

export type PossibleKeyword = ASTv2.Node;
type KeywordTypeFor<K extends Keyword> = K extends Keyword<string, unknown, infer KeywordType>
  ? KeywordType
  : never;
type NameFor<K extends Keyword> = K extends Keyword<infer Name> ? Name : never;
type OutFor<K extends Keyword> = K extends Keyword<string, infer Out> ? Out : never;

function getPathExpression(node: ASTv2.Node): ASTv2.PathExpression | string {
  if (node.type === 'PathExpression') {
    return node;
  } else if (node.type === 'AppendStatement') {
    return getPathExpression(node.value);
  } else if (ASTv2.isCall(node)) {
    if (node.func.type === 'Literal') {
      return node.func.type;
    } else {
      return getPathExpression(node.func);
    }
  } else {
    return node.type;
  }
}
export class Keywords<
  KeywordType extends keyof KeywordTypes,
  KeywordList extends Keyword<string, unknown, KeywordType> = never
> implements Keyword<NameFor<KeywordList>, OutFor<KeywordList>, KeywordType> {
  #keywords: Keyword[] = [];
  #type: KeywordType;

  constructor(type: KeywordType) {
    this.#type = type;
  }

  kw<S extends string = string, Out = unknown>(
    name: S,
    delegate: KeywordDelegate<S, KeywordType, unknown, Out>
  ): Keywords<KeywordType, KeywordList | Keyword<S, Out, KeywordType>> {
    this.#keywords.push(keyword(name, this.#type, delegate));

    return this as Keywords<KeywordType, KeywordList | Keyword<S, Out, KeywordType>>;
  }

  match(
    node:
      | PossibleKeyword
      | KeywordNode<KeywordTypes[KeywordTypeFor<KeywordList>], NameFor<KeywordList>>
  ): node is KeywordNode<KeywordTypes[KeywordTypeFor<KeywordList>], NameFor<KeywordList>> {
    for (let keyword of this.#keywords) {
      if (keyword.match(node)) {
        return true;
      }
    }

    return false;
  }

  translate(
    node: Match<KeywordTypeFor<KeywordList>, NameFor<KeywordList>>,
    ctx: VisitorContext
  ): Result<OutFor<KeywordList>> {
    for (let keyword of this.#keywords) {
      if (keyword.match(node)) {
        return keyword.translate(node, ctx) as Result<OutFor<KeywordList>>;
      }
    }

    throw unreachable();
  }
}

/**
 * This function builds keyword definitions for a particular type of AST node (`KeywordType`).
 *
 * You can build keyword definitions for:
 *
 * - `Expr`: A `SubExpression` or `PathExpression`
 * - `Block`: A `BlockStatement`
 *   - A `BlockStatement` is a keyword candidate if its head is a
 *     `PathExpression`
 * - `Append`: An `AppendStatement`
 *
 * A node is a keyword candidate if:
 *
 * - A `PathExpression` is a keyword candidate if it has no tail, and its
 *   head expression is a `LocalVarHead` or `FreeVarHead` whose name is
 *   the keyword's name.
 * - A `SubExpression`, `AppendStatement`, or `BlockStatement` is a keyword
 *   candidate if its head is a keyword candidate.
 *
 * The keyword infrastructure guarantees that:
 *
 * - If a node is not a keyword candidate, it is never passed to any keyword's
 *   `assert` method.
 * - If a node is not the `KeywordType` for a particular keyword, it will not
 *   be passed to the keyword's `assert` method.
 *
 * `Expr` keywords are used in expression positions and should return HIR
 * expressions. `Block` and `Append` keywords are used in statement
 * positions and should return HIR statements.
 *
 * A keyword definition has two parts:
 *
 * - `match`, which determines whether an AST node matches the keyword, and can
 *   optionally return some information extracted from the AST node.
 * - `translate`, which takes a matching AST node as well as the extracted
 *   information and returns an appropriate HIR instruction.
 *
 * # Example
 *
 * This keyword:
 *
 * - turns `(hello)` into `"hello"`
 *   - as long as `hello` is not in scope
 * - makes it an error to pass any arguments (such as `(hello world)`)
 *
 * ```ts
 * keywords('SubExpr').kw('hello', {
 *   assert(node: ExprKeywordNode): Result<void> | false {
 *     // we don't want to transform `hello` as a `PathExpression`
 *     if (node.type !== 'SubExpression') {
 *       return false;
 *     }
 *
 *     // node.head would be `LocalVarHead` if `hello` was in scope
 *     if (node.head.type !== 'FreeVarHead') {
 *       return false;
 *     }
 *
 *     if (node.params.length || node.hash) {
 *       return Err(new GlimmerSyntaxError(`(hello) does not take any arguments`), node.loc);
 *     } else {
 *       return Ok();
 *     }
 *   },
 *
 *   translate(node: ASTv2.SubExpression): hir.Expression {
 *     return ASTv2.builders.literal("hello", node.loc)
 *   }
 * })
 * ```
 *
 * The keyword infrastructure checks to make sure that the node is the right
 * type before calling `assert`, so you only need to consider `SubExpression`
 * and `PathExpression` here. It also checks to make sure that the node passed
 * to `assert` has the keyword name in the right place.
 *
 * Note the important difference between returning `false` from `assert`,
 * which just means that the node didn't match, and returning `Err`, which
 * means that the node matched, but there was a keyword-specific syntax
 * error.
 */
export function keywords<KeywordType extends keyof KeywordTypes>(
  type: KeywordType
): Keywords<KeywordType> {
  return new Keywords(type);
}
