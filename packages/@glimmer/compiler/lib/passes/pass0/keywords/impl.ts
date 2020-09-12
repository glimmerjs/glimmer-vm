import { ASTv2 } from '@glimmer/syntax';
import { unreachable } from '@glimmer/util';
import { Result } from '../../../shared/result';
import { ImmutableUtils, VisitorContext } from '../context';

export type KeywordNode<
  Node extends PossibleKeyword = PossibleKeyword,
  S extends string = string
> = Node & {
  path: ASTv2.PathExpression & { original: S };
};

interface KeywordDelegate<
  InputNode extends PossibleKeyword,
  MatchNode extends KeywordNode<InputNode>,
  V,
  Out
> {
  assert(node: InputNode, ctx: ImmutableUtils): V;
  translate(node: MatchNode, ctx: VisitorContext, param: V): Result<Out>;
}

export interface Keyword<
  S extends string = string,
  Node extends PossibleKeyword = PossibleKeyword,
  Out = unknown
> {
  match(mustache: Node): mustache is KeywordNode<Node, S>;
  translate(mustache: KeywordNode<Node, S>, ctx: VisitorContext): Result<Out>;
}

class KeywordImpl<
  S extends string = string,
  Node extends PossibleKeyword = PossibleKeyword,
  Param = unknown,
  Out = unknown
> implements Keyword<S, Node, Out> {
  constructor(
    private keyword: S,
    private delegate: KeywordDelegate<Node, KeywordNode<Node>, Param, Out>
  ) {}

  match(node: PossibleKeyword): node is KeywordNode<Node, S> {
    let path = getPathExpression(node);

    if (path === null) {
      return false;
    } else if (path.head.type === 'FreeVarHead') {
      return path.head.name === this.keyword;
    } else {
      return false;
    }
  }

  translate(mustache: KeywordNode<Node, S>, ctx: VisitorContext): Result<Out> {
    let param = this.delegate.assert(mustache, ctx.utils);
    return this.delegate.translate(mustache, ctx, param);
  }
}

export function keyword<
  S extends string = string,
  Node extends PossibleKeyword = PossibleKeyword,
  Out = unknown
>(
  keyword: S,
  delegate: KeywordDelegate<Node, KeywordNode<Node>, unknown, Out>
): Keyword<S, Node, Out> {
  return new KeywordImpl(keyword, delegate);
}

export type KeywordNodeFor<K extends Keyword> = K extends Keyword<infer Name, infer Node>
  ? KeywordNode<Node, Name>
  : never;

type PossibleKeyword = ASTv2.Call | ASTv2.PathExpression;
type NameFor<K extends Keyword> = K extends Keyword<infer Name> ? Name : never;
type NodeFor<K extends Keyword> = K extends Keyword<string, infer Node> ? Node : never;
type OutFor<K extends Keyword> = K extends Keyword<string, PossibleKeyword, infer Out>
  ? Out
  : never;

function getPathExpression(node: PossibleKeyword): ASTv2.PathExpression | null {
  if (node.type === 'PathExpression') {
    return node;
  } else if (node.path.type === 'PathExpression') {
    return node.path;
  } else {
    return null;
  }
}

export interface Keywords<Types extends Keyword = never>
  extends Keyword<NameFor<Types>, NodeFor<Types>, OutFor<Types>> {
  add<S extends string, Node extends PossibleKeyword, Out>(
    keyword: Keyword<S, Node, Out>
  ): Keywords<Types | Keyword<S, Node, Out>>;
}

class KeywordsImpl<Types extends Keyword = never>
  implements Keyword<NameFor<Types>, NodeFor<Types>, OutFor<Types>>, Keywords<Types> {
  #keywords: Keyword[] = [];

  add<S extends string, Node extends PossibleKeyword, Out>(
    keyword: Keyword<S, Node, Out>
  ): Keywords<Types | Keyword<S, Node, Out>> {
    this.#keywords.push(keyword);
    return this as Keywords<Types | Keyword<S, Node, Out>>;
  }

  match(node: NodeFor<Types>): node is KeywordNode<NodeFor<Types>, NameFor<Types>> {
    for (let keyword of this.#keywords) {
      if (keyword.match(node)) {
        return true;
      }
    }

    return false;
  }

  translate(
    node: KeywordNode<NodeFor<Types>, NameFor<Types>>,
    ctx: VisitorContext
  ): Result<OutFor<Types>> {
    for (let keyword of this.#keywords) {
      if (keyword.match(node)) {
        return keyword.translate(node, ctx) as Result<OutFor<Types>>;
      }
    }

    throw unreachable();
  }
}

export function keywords(): Keywords {
  return (new KeywordsImpl() as unknown) as Keywords<never>;
}
