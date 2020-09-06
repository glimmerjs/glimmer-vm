import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { PresentArray } from '@glimmer/interfaces';

export function isPath(node: AST.Node | AST.PathExpression): node is AST.PathExpression {
  return node.type === 'PathExpression';
}

export function isCall(node: AST.Node | AST.Call): node is AST.Call {
  return node.type === 'SubExpression' || node.type === 'MustacheStatement';
}

export type HasPath<Node extends AST.Call = AST.Call> = Node & {
  path: AST.PathExpression;
};

export type HasArguments =
  | {
      params: PresentArray<AST.Expression>;
    }
  | {
      hash: {
        pairs: PresentArray<AST.HashPair>;
      };
    };

export type HelperInvocation<Node extends AST.Call = AST.Call> = HasPath<Node> & HasArguments;

export function hasPath<N extends AST.Call>(node: N): node is HasPath<N> {
  return node.path.type === 'PathExpression';
}

export function isHelperInvocation<N extends AST.Call>(
  node: AST.Call
): node is HelperInvocation<N> {
  if (!hasPath(node)) {
    return false;
  }
  return (node.params && node.params.length > 0) || (node.hash && node.hash.pairs.length > 0);
}

export interface SimplePath extends AST.PathExpression {
  parts: [string];
  data: false;
  this: false;
}

export type SimpleHelper<N extends HasPath> = N & {
  path: SimplePath;
};

export function isSimplePath(path: AST.PathExpression): path is SimplePath {
  let { data, this: isThis, parts } = path;

  return !data && !isThis && parts.length === 1;
}

export function assertIsSimpleHelper<N extends HasPath>(
  helper: N,
  loc: AST.SourceLocation,
  context: string
): asserts helper is SimpleHelper<N> {
  if (!isSimplePath(helper.path)) {
    throw new GlimmerSyntaxError(
      `\`${helper.path.original}\` is not a valid name for a ${context} on line ${loc.start.line}.`,
      helper.loc
    );
  }
}

/**
 * This function is checking whether an AST node is a triple-curly, which means that it's
 * a "trusting" node. In the Handlebars AST, this is indicated by the `escaped` flag, which
 * is a bit of a double-negative, so we change the terminology here for clarity.
 */
export function isTrustingNode(
  value: AST.MustacheStatement | AST.TextNode | AST.ConcatStatement
): boolean {
  if (value.type === 'MustacheStatement') {
    return !value.escaped;
  } else {
    return false;
  }
}
