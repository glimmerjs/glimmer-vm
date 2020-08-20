import { AST } from '@glimmer/syntax';
import { unreachable } from '@glimmer/util';
import { Context, ImmutableContext } from '../context';

export type KeywordNode<Node extends AST.Call = AST.Call, S extends string = string> = Node & {
  path: AST.PathExpression & { original: S };
};

interface KeywordDelegate<
  InputNode extends AST.Call,
  MatchNode extends KeywordNode<InputNode>,
  V,
  Out
> {
  assert(node: InputNode, ctx: ImmutableContext): V;
  translate(node: MatchNode, ctx: Context, param: V): Out;
}

export interface Keyword<
  S extends string = string,
  Node extends AST.Call = AST.Call,
  Out = unknown
> {
  match(mustache: Node): mustache is KeywordNode<Node, S>;
  translate(mustache: KeywordNode<Node, S>, ctx: Context): Out;
}

class KeywordImpl<
  S extends string = string,
  Node extends AST.Call = AST.Call,
  Param = unknown,
  Out = unknown
> implements Keyword<S, Node, Out> {
  constructor(
    private keyword: S,
    private delegate: KeywordDelegate<Node, KeywordNode<Node>, Param, Out>
  ) {}

  match(mustache: Node): mustache is KeywordNode<Node, S> {
    if (mustache.path.type === 'PathExpression') {
      return mustache.path.original === this.keyword;
    } else {
      return false;
    }
  }

  translate(mustache: KeywordNode<Node, S>, ctx: Context): Out {
    let param = this.delegate.assert(mustache, ctx);
    return this.delegate.translate(mustache, ctx, param);
  }
}

export function keyword<S extends string = string, Node extends AST.Call = AST.Call, Out = unknown>(
  keyword: S,
  delegate: KeywordDelegate<Node, KeywordNode<Node>, unknown, Out>
): Keyword<S, Node, Out> {
  return new KeywordImpl(keyword, delegate);
}

export type KeywordNodeFor<K extends Keyword> = K extends Keyword<infer Name, infer Node, any>
  ? KeywordNode<Node, Name>
  : never;

type NameFor<K extends Keyword> = K extends Keyword<infer Name, AST.Call, any> ? Name : never;
type NodeFor<K extends Keyword> = K extends Keyword<string, infer Node, any> ? Node : never;
type OutFor<K extends Keyword> = K extends Keyword<string, AST.Call, infer Out> ? Out : never;

export interface Keywords<Types extends Keyword = never>
  extends Keyword<NameFor<Types>, NodeFor<Types>, OutFor<Types>> {
  add<S extends string, Node extends AST.Call, Out>(
    keyword: Keyword<S, Node, Out>
  ): Keywords<Types | Keyword<S, Node, Out>>;
}

class KeywordsImpl<Types extends Keyword = never>
  implements Keyword<NameFor<Types>, NodeFor<Types>, OutFor<Types>>, Keywords<Types> {
  #keywords: Keyword[] = [];

  add<S extends string, Node extends AST.Call, Out>(
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

  translate(node: KeywordNode<NodeFor<Types>, NameFor<Types>>, ctx: Context): OutFor<Types> {
    for (let keyword of this.#keywords) {
      if (keyword.match(node)) {
        return keyword.translate(node, ctx) as OutFor<Types>;
      }
    }

    throw unreachable();
  }
}

export function keywords(): Keywords {
  return (new KeywordsImpl() as unknown) as Keywords<never>;
}
