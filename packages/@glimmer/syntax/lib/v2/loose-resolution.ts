import * as ASTv1 from '../types/nodes-v1';
import { FreeVarResolution } from './objects';
import { LooseModeResolution, FreeVarNamespace, STRICT_RESOLUTION } from './objects';

export interface AstCallParts {
  path: ASTv1.Expression;
  params: ASTv1.Expression[];
  hash: ASTv1.Hash;
}

/**
 * The resolution for the expressions in the `params` and `hash`
 * of call nodes.
 */
export const ARGUMENT = LooseModeResolution.fallback();

export interface VarPath extends ASTv1.PathExpression {
  head: ASTv1.VarHead;
}

export function SexpSyntaxContext(node: ASTv1.SubExpression): FreeVarResolution | null {
  if (isSimpleCallee(node)) {
    return LooseModeResolution.namespaced(FreeVarNamespace.Helper);
  } else {
    return null;
  }
}

export function ModifierSyntaxContext(
  node: ASTv1.ElementModifierStatement
): FreeVarResolution | null {
  if (isSimpleCallee(node)) {
    return LooseModeResolution.namespaced(FreeVarNamespace.Modifier);
  } else {
    return null;
  }
}

export function BlockSyntaxContext(node: ASTv1.BlockStatement): FreeVarResolution | null {
  if (isSimpleCallee(node)) {
    return LooseModeResolution.namespaced(FreeVarNamespace.Component);
  } else {
    return null;
  }
}

export function ComponentSyntaxContext(node: ASTv1.PathExpression): FreeVarResolution | null {
  if (isSimplePath(node)) {
    return LooseModeResolution.namespaced(FreeVarNamespace.Component);
  } else {
    return null;
  }
}

/**
 * This corresponds to append positions (text curlies or attribute
 * curlies). In strict mode, this also corresponds to arg curlies.
 */
export function AttrValueSyntaxContext(node: ASTv1.MustacheStatement): FreeVarResolution {
  let isSimple = isSimpleCallee(node);
  let isInvoke = isInvokeNode(node);

  if (isSimple) {
    return isInvoke
      ? LooseModeResolution.namespaced(FreeVarNamespace.Helper)
      : LooseModeResolution.attr();
  } else {
    return isInvoke ? STRICT_RESOLUTION : LooseModeResolution.fallback();
  }
}

/**
 * This corresponds to append positions (text curlies or attribute
 * curlies). In strict mode, this also corresponds to arg curlies.
 */
export function AppendSyntaxContext(node: ASTv1.MustacheStatement): FreeVarResolution {
  let isSimple = isSimpleCallee(node);
  let isInvoke = isInvokeNode(node);

  if (isSimple) {
    return LooseModeResolution.append({ invoke: isInvoke });
  } else {
    return isInvoke ? STRICT_RESOLUTION : LooseModeResolution.fallback();
  }
}

export type Resolution<P extends AstCallParts | ASTv1.PathExpression> = (
  call: P
) => FreeVarResolution | null;

// UTILITIES

/**
 * A call node has a simple callee if its head is:
 *
 * - a `PathExpression`
 * - the `PathExpression`'s head is a `VarHead`
 * - it has no tail
 *
 * Simple heads:
 *
 * ```
 * {{x}}
 * {{x y}}
 * ```
 *
 * Not simple heads:
 *
 * ```
 * {{x.y}}
 * {{x.y z}}
 * {{@x}}
 * {{@x a}}
 * {{this}}
 * {{this a}}
 * ```
 */
function isSimpleCallee(node: AstCallParts): boolean {
  let path = node.path;

  return isSimplePath(path);
}

function isSimplePath(node: ASTv1.Expression): boolean {
  if (node.type === 'PathExpression' && node.head.type === 'VarHead') {
    return node.tail.length === 0;
  } else {
    return false;
  }
}

/**
 * The call expression has at least one argument.
 */
function isInvokeNode(node: AstCallParts): boolean {
  return node.params.length > 0 || node.hash.pairs.length > 0;
}
