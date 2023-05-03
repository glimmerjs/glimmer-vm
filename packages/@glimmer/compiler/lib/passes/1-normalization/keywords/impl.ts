import {
  ASTv2,
  generateSyntaxError,
  isKeyword,
  KEYWORDS_TYPES,
  KeywordType,
} from '@glimmer/syntax';
import { assert, exhausted } from '@glimmer/util';

import { Err, Result } from '../../../shared/result';
import { LooseKeywordExpression } from '../../2-encoding/mir';
import { NormalizationState } from '../context';

export interface KeywordDelegate<Match extends KeywordMatch, V, Out> {
  assert(options: Match, state: NormalizationState): Result<V>;
  translate(options: { node: Match; state: NormalizationState }, param: V): Result<Out>;
}

export interface Keyword<K extends KeywordType = KeywordType, Out = unknown> {
  translate(node: KeywordCandidates[K], state: NormalizationState): Result<Out> | null;
}

export interface BlockKeyword<Out = unknown> {
  translate(node: ASTv2.InvokeBlock, state: NormalizationState): Result<Out> | null;
}

class KeywordImpl<
  K extends KeywordType,
  S extends string = string,
  Param = unknown,
  Out = unknown
> {
  protected types: Set<KeywordCandidates[K]['type']>;

  constructor(
    protected keyword: S,
    type: KeywordType,
    private delegate: KeywordDelegate<KeywordMatches[K], Param, Out>,
    private options?: { compatible: boolean }
  ) {
    let nodes = new Set<KeywordNode['type']>();
    for (let nodeType of KEYWORD_NODES[type]) {
      nodes.add(nodeType);
    }

    this.types = nodes;
  }

  protected match(
    node: KeywordCandidates[K],
    state: NormalizationState
  ): node is KeywordMatches[K] {
    // some keywords are enabled only in strict mode. None are planned to be loose mode only
    // if (this.options?.strictOnly) {
    //   if (state.isStrict === false) {
    //     return false;
    //   }
    // }

    if (!this.types.has(node.type)) {
      return false;
    }

    let path = getCalleeExpression(node);

    // if the keyword is a local variable reference (including references to embedded in-scope local
    // variables in strict mode), then the local variable wins over the keyword.
    if (path !== null && path.type === 'Path' && path.ref.type === 'Free') {
      if (path.tail.length > 0) {
        // if we're looking at something like {{foo.bar baz}} in loose mode
        if (path.ref.resolution.serialize() === 'Loose') {
          // cannot be a keyword reference, keywords do not allow paths (must be
          // relying on implicit this fallback)
          return false;
        }

        return path.ref.name === this.keyword;
      } else {
        return false;
      }
    }
  }

  translate(node: KeywordMatches[K], state: NormalizationState): Result<Out> | null {
    if (this.match(node, state)) {
      let path = getCalleeExpression(node);

      if (path !== null && path.type === 'Path' && path.tail.length > 0) {
        return Err(
          generateSyntaxError(
            `The \`${
              this.keyword
            }\` keyword was used incorrectly. It was used as \`${path.loc.asString()}\`, but it cannot be used with additional path segments. \n\nError caused by`,
            node.loc
          )
        );
      }

      let param = this.delegate.assert(node, state);
      let keyword = param.andThen((param) => this.delegate.translate({ node, state }, param));

      let head = (path as ASTv2.PathExpression).ref;

      assert(head.type === 'Free', 'only free variables should succeed the match() test');

      // if we're in strict mode, then return the keyword
      if (head.resolution === ASTv2.STRICT_RESOLUTION || this.options?.compatible !== true) {
        return keyword;
      }

      // this code needs to be adjusted to handle non-calls

      return keyword.mapOk(
        (kw) =>
          (new LooseKeywordExpression({
            original: node as ASTv2.ExpressionNode,
            keyword: kw as ASTv2.ExpressionNode,
            loc: node.loc,
          }) as unknown) as Out
      );

      if (this.options?.compatible) {
        // if (path.head.type === 'Free') {
        // in loose mode, a compatible keyword loses to a resolved value for the same keyword
      }
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
  Call: ['Call'],
  Block: ['InvokeBlock'],
  Append: ['AppendContent'],
  Modifier: ['ElementModifier'],
} as const;

export interface KeywordCandidates {
  Call: ASTv2.ExpressionNode;
  Block: ASTv2.InvokeBlock;
  Append: ASTv2.AppendContent;
  Modifier: ASTv2.ElementModifier;
}

export type KeywordCandidate = KeywordCandidates[keyof KeywordCandidates];

export interface KeywordMatches {
  Call: ASTv2.CallExpression;
  Block: ASTv2.InvokeBlock;
  Append: ASTv2.AppendContent;
  Modifier: ASTv2.ElementModifier;
}

export type KeywordMatch = KeywordMatches[keyof KeywordMatches];

/**
 * A "generic" keyword is something like `has-block`, which makes sense in the context
 * of sub-expression or append
 */
export type GenericKeywordNode = ASTv2.AppendContent | ASTv2.CallExpression;

export type KeywordNode =
  | GenericKeywordNode
  | ASTv2.CallExpression
  | ASTv2.InvokeBlock
  | ASTv2.ElementModifier;

export function keyword<
  K extends KeywordType,
  D extends KeywordDelegate<KeywordMatches[K], unknown, Out>,
  Out = unknown
>(keyword: string, type: K, delegate: D, options?: { strictOnly: boolean }): Keyword<K, Out> {
  return new KeywordImpl(
    keyword,
    type,
    delegate as KeywordDelegate<KeywordMatch, unknown, Out>,
    options
  );
}

export type PossibleKeyword = KeywordNode;
type OutFor<K extends Keyword | BlockKeyword> = K extends BlockKeyword<infer Out>
  ? Out
  : K extends Keyword<KeywordType, infer Out>
  ? Out
  : never;

function getCalleeExpression(
  node: KeywordNode | ASTv2.ExpressionNode
): ASTv2.ExpressionNode | null {
  switch (node.type) {
    // This covers the inside of attributes and expressions, as well as the callee
    // of call nodes
    case 'Path':
      return node;
    case 'AppendContent':
      return getCalleeExpression(node.value);
    case 'Call':
    case 'InvokeBlock':
    case 'ElementModifier':
      return node.callee;
    default:
      return null;
  }
}

export class Keywords<K extends KeywordType, KeywordList extends Keyword<K> = never>
  implements Keyword<K, OutFor<KeywordList>>
{
  _keywords: Keyword[] = [];
  _type: K;

  constructor(type: K) {
    this._type = type;
  }

  kw<S extends string = string, Out = unknown>(
    name: S,
    delegate: KeywordDelegate<KeywordMatches[K], unknown, Out>,
    options?: { strictOnly: boolean }
  ): Keywords<K, KeywordList | Keyword<K, Out>> {
    this._keywords.push(keyword(name, this._type, delegate, options));

    return this;
  }

  translate(
    node: KeywordCandidates[K],
    state: NormalizationState
  ): Result<OutFor<KeywordList>> | null {
    for (let keyword of this._keywords) {
      let result = keyword.translate(node, state) as Result<OutFor<KeywordList>>;
      if (result !== null) {
        return result;
      }
    }

    let path = getCalleeExpression(node);

    if (path && path.type === 'Path' && path.ref.type === 'Free' && isKeyword(path.ref.name)) {
      let { name } = path.ref;

      let usedType = this._type;
      let validTypes = KEYWORDS_TYPES[name];

      if (validTypes.indexOf(usedType) === -1) {
        return Err(
          generateSyntaxError(
            `The \`${name}\` keyword was used incorrectly. It was used as ${
              typesToReadableName[usedType]
            }, but its valid usages are:\n\n${generateTypesMessage(
              name,
              validTypes
            )}\n\nError caused by`,
            node.loc
          )
        );
      }
    }

    return null;
  }
}

const typesToReadableName = {
  Append: 'an append statement',
  Block: 'a block statement',
  Call: 'a call expression',
  Modifier: 'a modifier',
};

function generateTypesMessage(name: string, types: KeywordType[]): string {
  return types
    .map((type) => {
      switch (type) {
        case 'Append':
          return `- As an append statement, as in: {{${name}}}`;
        case 'Block':
          return `- As a block statement, as in: {{#${name}}}{{/${name}}}`;
        case 'Call':
          return `- As an expression, as in: (${name})`;
        case 'Modifier':
          return `- As a modifier, as in: <div {{${name}}}></div>`;
        default:
          return exhausted(type);
      }
    })
    .join('\n\n');
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
 *       return Err(generateSyntaxError(`(hello) does not take any arguments`), node.loc);
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
