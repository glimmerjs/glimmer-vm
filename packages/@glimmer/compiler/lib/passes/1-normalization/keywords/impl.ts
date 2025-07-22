import type { KeywordType, SourceSpan } from '@glimmer/syntax';
import { exhausted } from '@glimmer/debug-util';
import {
  ASTv2,
  generateSyntaxError,
  isKeyword,
  KEYWORDS_TYPES,
  SourceSlice,
} from '@glimmer/syntax';

import type { Result } from '../../../shared/result';
import type { NormalizationState } from '../context';

import { Err } from '../../../shared/result';

export interface KeywordInfo<Match extends KeywordMatch> {
  node: Match;
  loc: SourceSpan;
  keyword: SourceSlice;
  state: NormalizationState;
  args: ASTv2.CurlyArgs;
}

export type InvokeKeywordInfo = KeywordInfo<InvokeKeywordMatch>;
export type ContentKeywordInfo = KeywordInfo<ContentKeywordMatch>;

export interface KeywordDelegate<Match extends KeywordMatch, V, Out> {
  assert: (info: KeywordInfo<Match>) => Result<V>;
  translate: (match: KeywordInfo<Match>, param: V) => Result<Out>;
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
  Out = unknown,
> {
  protected types: Set<KeywordMatches[K]['type']>;

  constructor(
    protected keyword: S,
    type: KeywordType,
    private delegate: KeywordDelegate<KeywordMatches[K], Param, Out>
  ) {
    let nodes = new Set<KeywordMatch['type']>();
    for (let nodeType of KEYWORD_NODES[type]) {
      nodes.add(nodeType);
    }

    this.types = nodes;
  }

  protected match(node: KeywordCandidates[K]): node is KeywordMatches[K] {
    if (!node.isResolved) return false;
    if (!node.resolved) return false;

    return node.resolved.name === this.keyword;
  }

  translate(node: KeywordMatches[K], state: NormalizationState): Result<Out> | null {
    if (this.match(node)) {
      const args = getKeywordArgs(node);
      const keyword = SourceSlice.keyword(this.keyword, node.resolved.loc);
      let param = this.delegate.assert({ node, keyword, loc: node.loc, state, args });
      return param.andThen((param) =>
        this.delegate.translate({ node, keyword, loc: node.loc, state, args }, param)
      );
    } else {
      return null;
    }
  }
}

function getKeywordArgs(node: KeywordMatch): ASTv2.CurlyArgs {
  if ('args' in node) {
    return node.args;
  } else {
    return ASTv2.EmptyCurlyArgs(node.resolved.loc.collapse('end'));
  }
}

export const KEYWORD_NODES = {
  Call: ['ResolvedCall', 'CurlyInvokeResolvedAttr'],
  Block: ['InvokeResolvedBlock'],
  Append: ['AppendResolvedContent', 'AppendResolvedInvokable'],
  Modifier: ['ResolvedElementModifier'],
} as const;

export interface KeywordCandidates {
  Call:
    | ASTv2.CallExpression
    | ASTv2.ResolvedCallExpression
    | ASTv2.CurlyInvokeResolvedAttr
    | ASTv2.CurlyResolvedAttrValue;
  Block: ASTv2.InvokeBlock | ASTv2.InvokeResolvedBlock;
  Append: ASTv2.AppendContent | ASTv2.AppendResolvedContent | ASTv2.AppendResolvedInvokable;
  Modifier: ASTv2.ElementModifier | ASTv2.ResolvedElementModifier;
}

export type KeywordCandidate = KeywordCandidates[keyof KeywordCandidates];

export type KeywordMatches = {
  [P in keyof KeywordCandidates]: Extract<KeywordCandidates[P], { isResolved: true }>;
};

export type KeywordMatch = KeywordMatches[keyof KeywordMatches];

/**
 * An invoke keyword candidate is something like `has-block`, which can be used as `(has-block)` or
 * `{{has-block}}`.
 */
export type InvokeKeywordMatch = CallKeywordMatch | AppendKeywordMatch;

/**
 * A content keyword candidate is something like `component`, which can be used as
 * `{{component ...}}`, `(component ...)` or `{{#component ...}}`
 */
export type ContentKeywordMatch = InvokeKeywordMatch | BlockKeywordMatch;

export type CallKeywordMatch = KeywordMatches['Call'];
export type AppendKeywordMatch = KeywordMatches['Append'];
export type BlockKeywordMatch = KeywordMatches['Block'];

export type KeywordNode =
  | AppendKeywordMatch
  | ASTv2.CallExpression
  | ASTv2.InvokeBlock
  | ASTv2.ElementModifier;

export type PossibleKeyword = KeywordNode;

export class Keywords<K extends KeywordType, Out = never> implements Keyword<K, Out> {
  _keywords: Keyword[] = [];
  _type: K;

  constructor(type: K) {
    this._type = type;
  }

  kw<const NewOut, V, S extends string = string>(
    name: S,
    delegate: KeywordDelegate<KeywordMatches[K], V, NewOut>
  ): Keywords<K, Out | NewOut> {
    this._keywords.push(new KeywordImpl(name, this._type, delegate));

    return this;
  }

  translate(node: KeywordCandidates[K], state: NormalizationState): Result<Out> | null {
    for (let keyword of this._keywords) {
      let result = keyword.translate(node, state);
      if (result !== null) {
        return result as Result<Out>;
      }
    }

    if (!node.isResolved) {
      return null;
    }

    if (node.resolved && isKeyword(node.resolved.name)) {
      let { name } = node.resolved;

      let usedType = this._type;
      let validTypes: readonly KeywordType[] = KEYWORDS_TYPES[name];

      if (!validTypes.includes(usedType)) {
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

function generateTypesMessage(name: string, types: readonly KeywordType[]): string {
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
