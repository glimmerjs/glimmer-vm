import { ASTv2, Source } from '@glimmer/syntax';
import { Result } from '../../../shared/result';
import { NormalizationUtilities } from '../context';

interface KeywordDelegate<Match extends KeywordMatch, V, Out> {
  assert(options: Match, source: Source): Result<V>;
  translate(options: Match, utils: NormalizationUtilities, param: V): Result<Out>;
}

export interface Keyword<K extends KeywordType = KeywordType, Out = unknown> {
  translate(node: KeywordCandidates[K], utils: NormalizationUtilities): Result<Out> | null;
}

class KeywordImpl<K extends KeywordType, S extends string = string, Param = unknown, Out = unknown>
  implements Keyword<K, Out> {
  private types: Set<KeywordCandidates[K]['type']>;

  constructor(
    private keyword: S,
    type: KeywordType,
    private delegate: KeywordDelegate<KeywordMatches[K], Param, Out>
  ) {
    let nodes = new Set<ASTv2.KeywordNode['type']>();
    for (let nodeType of KEYWORD_NODES[type]) {
      nodes.add(nodeType);
    }

    this.types = nodes;
  }

  private match(node: KeywordCandidates[K]): node is KeywordMatches[K] {
    if (!this.types.has(node.type)) {
      return false;
    }

    let path = getPathExpression(node);

    if (path !== null && path.ref.type === 'Free') {
      return path.ref.name === this.keyword;
    } else {
      return false;
    }
  }

  translate(node: KeywordMatches[K], utils: NormalizationUtilities): Result<Out> | null {
    if (this.match(node)) {
      let param = this.delegate.assert(node, utils.source);
      return param.andThen((param) => this.delegate.translate(node, utils, param));
    } else {
      return null;
    }
  }
}

export type PossibleNode =
  | ASTv2.PathExpression
  | ASTv2.AppendContent
  | ASTv2.CallExpression
  | ASTv2.InvokeBlock;

export const KEYWORD_NODES = {
  Expr: ['Call', 'Path'],
  Block: ['InvokeBlock'],
  Append: ['AppendContent'],
  Modifier: ['ElementModifier'],
} as const;

export interface KeywordCandidates {
  Expr: ASTv2.Expression;
  Block: ASTv2.InvokeBlock;
  Append: ASTv2.AppendContent;
  Modifier: ASTv2.ElementModifier;
}

export type KeywordCandidate = KeywordCandidates[keyof KeywordCandidates];

export interface KeywordMatches {
  Expr: ASTv2.CallExpression | ASTv2.PathExpression;
  Block: ASTv2.InvokeBlock;
  Append: ASTv2.AppendContent;
  Modifier: ASTv2.ElementModifier;
}

export type KeywordType = keyof KeywordMatches;
export type KeywordMatch = KeywordMatches[keyof KeywordMatches];

export type ExprKeywordNode = ASTv2.CallExpression | ASTv2.PathExpression;

/**
 * A "generic" keyword is something like `has-block`, which makes sense in the context
 * of sub-expression, path, or append
 */
export type GenericKeywordNode = ASTv2.AppendContent | ASTv2.CallExpression | ASTv2.PathExpression;

export function keyword<
  K extends KeywordType,
  D extends KeywordDelegate<KeywordMatches[K], unknown, Out>,
  Out = unknown
>(keyword: string, type: K, delegate: D): Keyword<K, Out> {
  return new KeywordImpl(keyword, type, delegate);
}

export type PossibleKeyword = ASTv2.KeywordNode;
type OutFor<K extends Keyword> = K extends Keyword<KeywordType, infer Out> ? Out : never;

function getPathExpression(
  node: ASTv2.KeywordNode | ASTv2.ExpressionNode
): ASTv2.PathExpression | null {
  switch (node.type) {
    // This covers the inside of attributes and expressions, as well as the callee
    // of call nodes
    case 'Path':
      return node;
    case 'AppendContent':
      return getPathExpression(node.value);
    case 'Call':
    case 'ElementModifier':
    case 'InvokeBlock':
      return getPathExpression(node.callee);
    default:
      return null;
  }
}
export class Keywords<K extends KeywordType, KeywordList extends Keyword<K> = never>
  implements Keyword<K, OutFor<KeywordList>> {
  #keywords: Keyword[] = [];
  #type: KeywordType;

  constructor(type: KeywordType) {
    this.#type = type;
  }

  kw<S extends string = string, Out = unknown>(
    name: S,
    delegate: KeywordDelegate<KeywordMatches[K], unknown, Out>
  ): Keywords<K, KeywordList | Keyword<K, Out>> {
    this.#keywords.push(keyword(name, this.#type, delegate));

    return this as Keywords<K, KeywordList | Keyword<K, Out>>;
  }

  translate(
    node: KeywordCandidates[K],
    utils: NormalizationUtilities
  ): Result<OutFor<KeywordList>> | null {
    for (let keyword of this.#keywords) {
      // if (keyword.match(node)) {
      let result = keyword.translate(node, utils) as Result<OutFor<KeywordList>>;
      if (result !== null) {
        return result;
      }
    }

    return null;
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
export function keywords<K extends KeywordType>(type: K): Keywords<K> {
  return new Keywords(type);
}
