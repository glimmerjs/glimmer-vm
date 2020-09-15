import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { PresentArray, VariableResolution } from '@glimmer/interfaces';
import { unreachable } from '@glimmer/util';

export function isPath(node: ASTv2.Node | ASTv2.PathExpression): node is ASTv2.PathExpression {
  return node.type === 'PathExpression';
}

export function isCall(node: ASTv2.Node | ASTv2.CallNode): node is ASTv2.CallNode {
  return node.type === 'SubExpression' || node.type === 'AppendStatement';
}

export type HasPath<Node extends ASTv2.CallNode = ASTv2.CallNode> = Node & {
  head: ASTv2.PathExpression;
};

export type HasArguments =
  | {
      params: PresentArray<ASTv2.InternalExpression>;
    }
  | {
      hash: {
        pairs: PresentArray<ASTv2.HashPair>;
      };
    };

export type HelperInvocation<Node extends ASTv2.CallNode = ASTv2.CallNode> = HasPath<Node> &
  HasArguments;

export function hasPath<N extends ASTv2.CallNode>(node: N): node is HasPath<N> {
  return node.func.type === 'PathExpression';
}

export function isHelperInvocation<N extends ASTv2.CallNode>(
  node: ASTv2.CallNode
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

export function isSimplePath(path: ASTv2.InternalExpression): path is SimplePath {
  if (path.type === 'PathExpression') {
    let { head, tail: parts } = path;

    return (
      head.type === 'FreeVarHead' &&
      head.context !== VariableResolution.Strict &&
      parts.length === 0
    );
  } else {
    return false;
  }
}

export function isStrictHelper(expr: HasPath): boolean {
  if (expr.func.type !== 'PathExpression') {
    return true;
  }

  if (expr.func.head.type !== 'FreeVarHead') {
    return true;
  }

  return expr.func.head.context === VariableResolution.Strict;
}

export function assertIsValidHelper<N extends HasPath>(
  helper: N,
  loc: ASTv2.SourceLocation,
  context: string
): asserts helper is SimpleHelper<N> {
  if (isStrictHelper(helper) || isSimplePath(helper.func)) {
    return;
  }

  throw new GlimmerSyntaxError(
    `\`${printPath(helper.func)}\` is not a valid name for a ${context} on line ${loc.start.line}.`,
    helper.loc
  );
}

function printPath(path: ASTv2.InternalExpression): string {
  switch (path.type) {
    case 'Literal':
      return JSON.stringify(path.value);
    case 'PathExpression': {
      let printedPath = [printPathHead(path.head)];
      printedPath.push(...path.tail);
      return printedPath.join('.');
    }
    case 'SubExpression':
      return `(${printPath(path.func)} ...)`;
    case 'Interpolate':
      throw unreachable('a concat statement cannot appear as the head of an expression');
  }
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
  value: ASTv2.AppendStatement | ASTv2.TextNode | ASTv2.Interpolate
): boolean {
  if (value.type === 'AppendStatement') {
    return value.trusting;
  } else {
    return false;
  }
}
