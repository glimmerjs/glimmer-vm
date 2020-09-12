import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { PresentArray } from '@glimmer/interfaces';

export function isPath(node: ASTv2.Node | ASTv2.PathExpression): node is ASTv2.PathExpression {
  return node.type === 'PathExpression';
}

export function isCall(node: ASTv2.Node | ASTv2.Call): node is ASTv2.Call {
  return node.type === 'SubExpression' || node.type === 'MustacheStatement';
}

export type HasPath<Node extends ASTv2.Call = ASTv2.Call> = Node & {
  path: ASTv2.PathExpression;
};

export type HasArguments =
  | {
      params: PresentArray<ASTv2.Expression>;
    }
  | {
      hash: {
        pairs: PresentArray<ASTv2.HashPair>;
      };
    };

export type HelperInvocation<Node extends ASTv2.Call = ASTv2.Call> = HasPath<Node> & HasArguments;

export function hasPath<N extends ASTv2.Call>(node: N): node is HasPath<N> {
  return node.path.type === 'PathExpression';
}

export function isHelperInvocation<N extends ASTv2.Call>(
  node: ASTv2.Call
): node is HelperInvocation<N> {
  if (!hasPath(node)) {
    return false;
  }
  return (node.params && node.params.length > 0) || (node.hash && node.hash.pairs.length > 0);
}

export interface SimplePath extends ASTv2.PathExpression {
  tail: [string];
  data: false;
  this: false;
}

export type SimpleHelper<N extends HasPath> = N & {
  path: SimplePath;
};

export function isSimplePath(path: ASTv2.PathExpression): path is SimplePath {
  let { head, tail: parts } = path;

  return head.type === 'FreeVarHead' && parts.length === 0;
}

export function assertIsSimpleHelper<N extends HasPath>(
  helper: N,
  loc: ASTv2.SourceLocation,
  context: string
): asserts helper is SimpleHelper<N> {
  if (!isSimplePath(helper.path)) {
    throw new GlimmerSyntaxError(
      `\`${printPath(helper.path)}\` is not a valid name for a ${context} on line ${
        loc.start.line
      }.`,
      helper.loc
    );
  }
}

function printPath(path: ASTv2.PathExpression): string {
  let printedPath = [printPathHead(path.head)];
  printedPath.push(...path.tail);
  return printedPath.join('.');
}

function printPathHead(head: ASTv2.PathHead): string {
  switch (head.type) {
    case 'AtHead':
    case 'FreeVarHead':
    case 'LocalVarHead':
      return head.name;
    case 'ThisHead':
      return 'this';
  }
}

/**
 * This function is checking whether an AST node is a triple-curly, which means that it's
 * a "trusting" node. In the Handlebars AST, this is indicated by the `escaped` flag, which
 * is a bit of a double-negative, so we change the terminology here for clarity.
 */
export function isTrustingNode(
  value: ASTv2.MustacheStatement | ASTv2.TextNode | ASTv2.Interpolate
): boolean {
  if (value.type === 'MustacheStatement') {
    return !value.escaped;
  } else {
    return false;
  }
}
