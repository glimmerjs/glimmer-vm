import { VariableResolutionContext } from '@glimmer/interfaces';
import { unreachable } from '@glimmer/util';
import * as ASTv1 from '../types/nodes-v1';

export interface AstCallParts {
  path: ASTv1.Expression;
  params: ASTv1.Expression[];
  hash: ASTv1.Hash;
}

/**
 * This represents an expression's syntax context.
 *
 * Possible contexts:
 *
 * - `ArgumentSyntaxContext`, the syntax context for expressions in the `params` and hash
 *   of call nodes.
 * - `SexpSyntaxContext`, the syntax context for the callee of `(sexp)` syntax
 * - `ModifierSyntaxContext`, the syntax context for the callee of modifiers
 * - `BlockSyntaxContext`, the syntax context for the callee of blocks
 * - `ComponentSyntaxContext`, the syntax context for the callee of components
 * - `AttrValueSyntaxContext`, the syntax context for the callee of curlies used
 *   in attribute values (including interpolations)
 * - `AppendSyntaxContext`, the syntax context for the callee of curlies used in
 *   content positions.
 */
export interface SyntaxContext {
  resolution(): VariableResolutionContext;
}

/**
 * The syntax context for the expressions in the `params` and `hash`
 * of call nodes.
 */
export class ArgumentSyntaxContext implements SyntaxContext {
  resolution(): VariableResolutionContext {
    return VariableResolutionContext.LooseFreeVariable;
  }
}

export const ARGUMENT = new ArgumentSyntaxContext();

export interface VarPath extends ASTv1.PathExpression {
  head: ASTv1.VarHead;
}

export class CallDetails {
  constructor(private isSimple: boolean, private isInvoke: boolean) {}
  resolution(options: {
    ifCall: VariableResolutionContext;
    else: VariableResolutionContext;
  }): VariableResolutionContext {
    if (this.isSimple && !this.isInvoke) {
      return options.else;
    } else if (this.isSimple && this.isInvoke) {
      return options.ifCall;
    } else if (!this.isSimple && this.isInvoke) {
      return VariableResolutionContext.Strict;
    } else if (!this.isSimple && !this.isInvoke) {
      return VariableResolutionContext.LooseFreeVariable;
    }

    throw unreachable();
  }
}

abstract class CallSyntaxContext implements SyntaxContext {
  constructor(readonly ast: AstCallParts) {}

  abstract readonly bare: VariableResolutionContext;
  abstract readonly invoke: VariableResolutionContext;

  resolution(): VariableResolutionContext {
    return this.details().resolution({
      ifCall: this.invoke,
      else: this.bare,
    });
  }

  details(): CallDetails {
    return new CallDetails(this.isSimpleCallee, this.isInvoke);
  }

  /**
   * Is the head of the call node a `PathExpression` whose head is a
   * `VarHead`?
   *
   * This rules out expressions that are not paths (e.g. `{{"hello"}}`) and path
   * expressions that begin with `@args` or `this` (because they don't trigger
   * any loose mode behavior).
   */
  headIsVarPath(): this is { ast: { path: VarPath } } {
    let path = this.ast.path;

    return path.type === 'PathExpression' && path.head.type === 'VarHead';
  }

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
  get isSimpleCallee(): boolean {
    let path = this.ast.path;

    if (path.type === 'PathExpression' && path.head.type === 'VarHead') {
      return path.tail.length === 0;
    } else {
      return false;
    }
  }

  /**
   * The call expression has at least one argument.
   */
  get isInvoke(): boolean {
    return this.ast.params.length > 0 || this.ast.hash.pairs.length > 0;
  }
}

/**
 * Define a syntax context for an ASTv1 CallNode.
 *
 * The rules for a CallNode syntax context are:
 *
 * If the head is not simple:
 *
 * - if the call node has arguments, it uses strict variable resolution
 * - if the call node has no arguments, it uses loose free variable resolution
 *
 * If the head is simple:
 *
 * - if the call node has arguments, use the `invoke` resolution provided to this function
 * - if the call node has no arguments, use the `bare` resolution provided to this function
 *
 * If a single variable resolution is provided, it serves as both the `bare` and `invoke` resolution.
 */
function callContext(
  definition:
    | {
        bare: VariableResolutionContext;
        invoke: VariableResolutionContext;
      }
    | VariableResolutionContext
): CallSyntaxContextConstructor {
  let { bare, invoke } =
    typeof definition === 'number' ? { bare: definition, invoke: definition } : definition;

  return class extends CallSyntaxContext {
    readonly bare = bare;
    readonly invoke = invoke;
  };
}

export const SexpSyntaxContext = callContext(VariableResolutionContext.ResolveAsCallHead);
export const ModifierSyntaxContext = callContext(VariableResolutionContext.ResolveAsModifierHead);
export const BlockSyntaxContext = callContext(VariableResolutionContext.ResolveAsBlockHead);

export const ComponentSyntaxContent = {
  resolution(): VariableResolutionContext {
    return VariableResolutionContext.ResolveAsComponentHead;
  },
};

/**
 * This corresponds to append positions (text curlies or attribute
 * curlies). In strict mode, this also corresponds to arg curlies.
 */
export const AttrValueSyntaxContext = callContext({
  bare: VariableResolutionContext.AmbiguousAttr,
  invoke: VariableResolutionContext.ResolveAsCallHead,
});

/**
 * This corresponds to append positions (text curlies or attribute
 * curlies). In strict mode, this also corresponds to arg curlies.
 */
export const AppendSyntaxContext = callContext({
  bare: VariableResolutionContext.AmbiguousAppend,
  invoke: VariableResolutionContext.AmbiguousAppendInvoke,
});

export interface CallSyntaxContextConstructor {
  new (call: ASTv1.CallParts): SyntaxContext;
}
