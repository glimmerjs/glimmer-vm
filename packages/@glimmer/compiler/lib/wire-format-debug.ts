import type {
  HasBlocksFlag,
  HasNamedArgsFlag,
  HasPositionalArgsFlag,
  Optional,
  SerializedInlineBlock,
  SerializedTemplateBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { BUILDER_APPEND, BUILDER_CONCAT, BUILDER_LITERAL } from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { dict } from '@glimmer/util';
import {
  BLOCKS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

import { inflateAttrName, inflateTagName } from './utils';

export default class WireFormatDebugger {
  private upvars: string[];
  private symbols: string[];
  private lexicalSymbols: string[];

  constructor([_statements, symbols, upvars, lexical = []]: SerializedTemplateBlock) {
    this.upvars = upvars;
    this.symbols = symbols;
    this.lexicalSymbols = lexical;
  }

  format(program: SerializedTemplateBlock): unknown {
    let out = [];

    for (let statement of program[0]) {
      out.push(this.formatOpcode(statement));
    }

    return out;
  }

  private isHelperCall(opcode: unknown): opcode is WireFormat.Expressions.StackExpression {
    if (!Array.isArray(opcode) || opcode[0] !== Op.StackExpression) {
      return false;
    }
    const [, first, ...rest] = opcode as WireFormat.Expressions.StackExpression;
    if (!Array.isArray(first) || first[0] !== Op.BeginCall) {
      return false;
    }
    const lastOp = rest[rest.length - 1];
    return Array.isArray(lastOp) && lastOp[0] === Op.CallHelper;
  }

  private isExpression(
    opcode: Exclude<WireFormat.Syntax, WireFormat.Expressions.Value | undefined>
  ): opcode is WireFormat.Expressions.Expression {
    if (typeof opcode === 'number') {
      // Check if it's a SimpleStackOp
      return (
        opcode === Op.Not ||
        opcode === Op.HasBlock ||
        opcode === Op.HasBlockParams ||
        opcode === Op.GetDynamicVar ||
        opcode === Op.IfInline ||
        opcode === Op.Undefined
      );
    }

    if (!Array.isArray(opcode)) {
      return false;
    }

    const [op] = opcode;
    // Check if it's an expression opcode
    return op === Op.StackExpression || op === Op.GetLocalSymbol || op === Op.GetLexicalSymbol;
  }

  private formatExpression(expr: WireFormat.Expressions.Expression): unknown {
    if (typeof expr === 'number') {
      // SimpleStackOp
      switch (expr) {
        case Op.Not:
          return `not`;
        case Op.HasBlock:
          return `has-block`;
        case Op.HasBlockParams:
          return `has-block-params`;
        case Op.GetDynamicVar:
          return `get-dynamic-var`;
        case Op.IfInline:
          return `if-inline`;
        case Op.Undefined:
          return `undefined`;
        default:
          return expr;
      }
    }

    if (!Array.isArray(expr)) {
      // This shouldn't happen with the new type
      return expr;
    }

    switch (expr[0]) {
      case Op.StackExpression:
        return this.formatStackExpression(expr);
      case Op.GetLocalSymbol:
        if (expr[1] === 0) {
          return 'this';
        } else {
          const symbol = this.symbols[expr[1] - 1];
          return symbol || `local:${expr[1]}`;
        }
      case Op.GetLexicalSymbol:
        return this.lexicalSymbols[expr[1]] || `lexical:${expr[1]}`;
      case Op.GetKeyword:
        return `^${this.upvars[expr[1]]}`;
      default:
        return ['unknown-expression', expr];
    }
  }

  private formatStackExpression(expr: WireFormat.Expressions.StackExpression): unknown {
    const [, first, ...rest] = expr;

    // Check if this is a concat pattern (ends with [Op.Concat, arity])
    if (rest.length > 0) {
      const lastOp = rest[rest.length - 1];
      if (Array.isArray(lastOp) && lastOp[0] === Op.Concat) {
        // Format as a human-readable concat for test compatibility
        const concatParts: unknown[] = [];

        // Process all operations except the final Concat to extract the values
        const ops = [first, ...rest.slice(0, -1)];
        let i = 0;
        while (i < ops.length) {
          const op = ops[i];

          if (Array.isArray(op)) {
            switch (op[0]) {
              case Op.PushConstant:
                // String literals
                if (typeof op[1] === 'string') {
                  concatParts.push([BUILDER_LITERAL, op[1]]);
                } else {
                  concatParts.push(op[1]);
                }
                i++;
                break;

              case Op.PushImmediate:
                concatParts.push(op[1]);
                i++;
                break;

              case Op.BeginCall: {
                // This starts a helper call pattern
                // Look for the pattern: BeginCall, [args...], PushArgs, CallHelper
                const helperOps: WireFormat.Expressions.StackOperation[] = [];
                i++; // Skip BeginCall

                // Collect operations until we hit PushArgs
                while (i < ops.length) {
                  const nextOp = ops[i];
                  if (nextOp !== undefined && Array.isArray(nextOp) && nextOp[0] === Op.PushArgs) {
                    break;
                  }
                  if (nextOp !== undefined) {
                    helperOps.push(nextOp);
                  }
                  i++;
                }

                // Now we should be at PushArgs
                if (i < ops.length) {
                  const maybePushArgs = ops[i];
                  if (Array.isArray(maybePushArgs) && maybePushArgs[0] === Op.PushArgs) {
                    i++; // Skip PushArgs

                    // Next should be CallHelper
                    if (i < ops.length) {
                      const maybeCallHelper = ops[i];
                      if (Array.isArray(maybeCallHelper) && maybeCallHelper[0] === Op.CallHelper) {
                        const helperSymbol = maybeCallHelper[1];
                        const helperName = this.upvars[helperSymbol];

                        // Format the helper call
                        if (helperOps.length === 0) {
                          // No arguments - simple variable reference
                          concatParts.push(`^${helperName}`);
                        } else {
                          // With arguments - helper call
                          const args: unknown[] = [];
                          for (const argOp of helperOps) {
                            if (Array.isArray(argOp)) {
                              if (argOp[0] === Op.PushConstant) {
                                args.push(argOp[1]);
                              } else if (argOp[0] === Op.PushImmediate) {
                                args.push(argOp[1]);
                              } else if (argOp[0] === Op.GetLocalSymbol) {
                                const symbolIndex = argOp[1];
                                if (symbolIndex === 0) {
                                  args.push('this');
                                } else {
                                  const symbol = this.symbols[symbolIndex - 1];
                                  args.push(symbol || `local:${symbolIndex}`);
                                }
                              }
                            }
                          }
                          concatParts.push([`(^${helperName})`, args]);
                        }
                        i++;
                      }
                    }
                  }
                }
                break;
              }

              case Op.GetLocalSymbol:
                // Variable references
                if (op[1] === 0) {
                  concatParts.push('this');
                } else {
                  const symbol = this.symbols[op[1] - 1];
                  concatParts.push(symbol || `local:${op[1]}`);
                }
                i++;
                break;

              case Op.GetLexicalSymbol:
                concatParts.push(this.lexicalSymbols[op[1]] || `lexical:${op[1]}`);
                i++;
                break;

              case Op.GetKeyword:
                concatParts.push(`^${this.upvars[op[1]]}`);
                i++;
                break;

              default:
                // For other operations, just skip
                i++;
                break;
            }
          } else if (typeof op === 'number') {
            // Handle simple opcodes
            i++;
          }
        }

        return [BUILDER_CONCAT, ...concatParts];
      }

      // Check if this is a log pattern (ends with [Op.Log, arity])
      if (Array.isArray(lastOp) && lastOp[0] === Op.Log) {
        // Format as a human-readable log for test compatibility
        const logArgs: unknown[] = [];

        // Process all operations except the final Log to extract the arguments
        const ops = [first, ...rest.slice(0, -1)];
        for (const op of ops) {
          if (Array.isArray(op)) {
            switch (op[0]) {
              case Op.PushConstant:
                logArgs.push(op[1]);
                break;

              case Op.PushImmediate:
                logArgs.push(op[1]);
                break;

              case Op.GetLocalSymbol:
                if (op[1] === 0) {
                  logArgs.push('this');
                } else {
                  const symbol = this.symbols[op[1] - 1];
                  logArgs.push(symbol || `local:${op[1]}`);
                }
                break;

              case Op.GetLexicalSymbol: {
                const lexSymbol = this.lexicalSymbols[op[1]];
                logArgs.push(lexSymbol || `lexical:${op[1]}`);
                break;
              }

              default:
                // For other stack operations, we need special handling
                // PushArgs is not a valid Syntax type, so handle it separately
                if (Array.isArray(op) && op[0] === Op.PushArgs) {
                  // Format PushArgs operation
                  const [, names, blockNames, flags] = op;
                  logArgs.push(
                    `<PushArgs names=[${names.join(',')}] blocks=[${blockNames.join(',')}] flags=${flags}>`
                  );
                } else {
                  // For operations we can't format, just push a representation
                  logArgs.push(`<op:${Array.isArray(op) ? op[0] : op}>`);
                }
                break;
            }
          } else if (typeof op === 'string' || typeof op === 'number') {
            logArgs.push(op);
          }
        }

        return ['log', logArgs];
      }
    }

    // Check if this is a path expression pattern
    if (
      Array.isArray(first) &&
      (first[0] === Op.GetLocalSymbol || first[0] === Op.GetLexicalSymbol)
    ) {
      const isPath =
        rest.length === 0 || rest.every((op) => Array.isArray(op) && op[0] === Op.GetProperty);
      if (isPath && rest.length > 0) {
        // Format as a path string for test compatibility
        let path = '';
        if (first[0] === Op.GetLocalSymbol) {
          if (first[1] === 0) {
            path = 'this';
          } else {
            const symbol = this.symbols[first[1] - 1];
            path = symbol || `local:${first[1]}`;
          }
        } else {
          path = this.lexicalSymbols[first[1]] || `lexical:${first[1]}`;
        }
        // Append property accesses
        for (const op of rest) {
          if (Array.isArray(op) && op[0] === Op.GetProperty) {
            path += `.${op[1]}`;
          }
        }
        return path;
      }
    }

    // Handle single operation stack expressions
    if (rest.length === 0 && Array.isArray(first)) {
      switch (first[0]) {
        case Op.PushConstant:
        case Op.PushImmediate:
          return first[1];
        case Op.GetLocalSymbol:
          if (first[1] === 0) {
            return 'this';
          } else {
            const symbol = this.symbols[first[1] - 1];
            if (symbol && symbol.startsWith('@')) {
              return symbol;
            }
            return symbol || ['get-symbol', first[1]];
          }
        case Op.GetLexicalSymbol:
          return this.lexicalSymbols[first[1]];
        case Op.BeginCall:
          return ['begin-call'];
      }
    }

    // Format as generic stack expression
    return ['stack-expression', ...this.formatStackExpressionOps(expr)];
  }

  private formatStackExpressionOps(
    stackExpression: WireFormat.Expressions.StackExpression
  ): unknown[] {
    const [, ...ops] = stackExpression;

    return ops.flatMap((op) => {
      // Handle numeric opcodes (SimpleStackOp)
      if (typeof op === 'number') {
        switch (op) {
          case Op.Not:
            return 'not';
          case Op.HasBlock:
            return 'has-block';
          case Op.HasBlockParams:
            return 'has-block-params';
          case Op.GetDynamicVar:
            return 'get-dynamic-var';
          case Op.IfInline:
            return 'if-inline';
          default:
            return op;
        }
      }

      if (Array.isArray(op)) {
        switch (op[0]) {
          case Op.GetProperty:
            return ['get-property', op[1]];
          case Op.GetLocalSymbol:
            return ['get-local-symbol', this.symbols[op[1]]];
          case Op.GetLexicalSymbol:
            return ['get-lexical-symbol', this.lexicalSymbols[op[1]]];
          case Op.PushConstant:
            return ['push-constant', op[1]];
          case Op.PushImmediate:
            return ['push-immediate', op[1]];
          case Op.BeginCall:
            return ['begin-call'];
          case Op.BeginCallDynamic:
            return ['begin-call-dynamic'];
          case Op.PushArgs:
            return ['push-args:todo', op.slice(1)];
          case Op.CallHelper:
            return ['call-helper:todo', op.slice(1)];
          case Op.CallDynamicHelper:
            return ['call-dynamic-helper:todo', op.slice(1)];
          case Op.Concat:
            return [BUILDER_CONCAT, `<${op[1]} items>`];
          default:
            // Handle other operations
            if (Array.isArray(op) && op.length > 0) {
              const opcode = op[0];
              switch (opcode) {
                case Op.GetKeyword:
                  return `^${this.upvars[op[1]]}`;
                case Op.Curry:
                  return ['curry', op[1]];
                case Op.CallDynamicValue:
                  return ['call', this.formatExpression(op[1]), this.formatArgs(op[2])];
                case Op.Log:
                  return ['log', op[1]];
                case Op.ResolveAsCurlyCallee:
                  return ['curly-component-definition', this.upvars[op[1]]];
                case Op.ResolveAsModifierCallee:
                  return ['modifier-definition', this.upvars[op[1]]];
                case Op.ResolveAsComponentCallee:
                  return ['component-definition', this.upvars[op[1]]];
                case Op.ResolveAsHelperCallee:
                  return ['helper-definition', this.upvars[op[1]]];
              }
            }
            return ['unknown-stack-op', op];
        }
      }
      return ['unknown-op', op];
    });
  }

  private formatHelperCall(opcode: WireFormat.Expressions.StackExpression): unknown {
    const [, , ...rest] = opcode;
    const lastOp = rest[rest.length - 1] as [number, number];
    const helperSymbol = lastOp[1];
    const helper = this.upvars[helperSymbol];

    // Find PushArgs to determine argument structure
    let pushArgsOp: WireFormat.Expressions.PushArgs | null = null;
    let pushArgsIndex = -1;
    for (let i = 0; i < rest.length; i++) {
      const op = rest[i];
      if (Array.isArray(op) && op[0] === Op.PushArgs) {
        pushArgsOp = op;
        pushArgsIndex = i;
        break;
      }
    }

    if (!pushArgsOp) {
      return [`(^${helper})`];
    }

    const [, namedNames, , flags] = pushArgsOp;
    const positionalCount = (flags >> 4) & 0xf;

    // Extract positional arguments (ops between BeginCall and PushArgs)
    const positionalArgs: unknown[] = [];
    for (let i = 0; i < pushArgsIndex; i++) {
      const op = rest[i];
      if (Array.isArray(op)) {
        if (op[0] === Op.PushImmediate) {
          positionalArgs.push(op[1]);
        } else if (op[0] === Op.PushConstant) {
          positionalArgs.push(op[1]);
        } else if (op[0] === Op.GetLocalSymbol) {
          // Handle argument references like @url
          const symbol = this.symbols[op[1] - 1];
          positionalArgs.push(symbol || this.formatOpcode(op as WireFormat.Syntax));
        } else {
          positionalArgs.push(this.formatOpcode(op as WireFormat.Syntax));
        }
      }
    }

    // Extract named arguments (should come after positional, before PushArgs)
    const namedArgs: Record<string, unknown> = {};
    if (namedNames.length > 0) {
      const namedValueOps = positionalArgs.splice(positionalCount);
      for (let i = 0; i < namedNames.length; i++) {
        const name = namedNames[i];
        if (name !== undefined) {
          namedArgs[name] = namedValueOps[i];
        }
      }
    }

    // Format according to test DSL
    const result: unknown[] = [`(^${helper})`];
    if (positionalArgs.length > 0) {
      result.push(positionalArgs);
    }
    if (Object.keys(namedArgs).length > 0) {
      result.push(namedArgs);
    }

    return result.length === 1 ? result[0] : result;
  }

  formatStaticValue(value: WireFormat.Expressions.Value | [WireFormat.UndefinedOpcode]): unknown {
    if (Array.isArray(value)) {
      return undefined;
    } else {
      return value;
    }
  }

  formatOpcode(opcode: WireFormat.Syntax): unknown {
    if (isSimple(opcode)) {
      // Handle SimpleStackOp (numeric opcodes)
      switch (opcode) {
        case Op.Not:
          return `not`;
        case Op.HasBlock:
          return `has-block`;
        case Op.HasBlockParams:
          return `has-block-params`;
        case Op.GetDynamicVar:
          return `get-dynamic-var`;
        case Op.IfInline:
          return `if-inline`;
        case Op.Undefined:
          return `undefined`;
        default:
          return opcode;
      }
    }

    // For non-concat contexts, check if this is a helper call
    if (this.isHelperCall(opcode)) {
      return this.formatHelperCall(opcode);
    }

    if (isTuple(opcode)) {
      // Handle expression opcodes
      if (this.isExpression(opcode)) {
        return this.formatExpression(opcode);
      }

      // Handle content opcodes
      switch (opcode[0]) {
        case Op.AppendValueCautiously:
          // For simple appends, just return the expression directly
          return this.formatAppendExpression(opcode[1]);
        case Op.AppendTrustedHtml:
          return ['trusting-append', this.formatOpcode(opcode[1])];
        case Op.InElement:
          return [
            'in-element',
            opcode[1],
            opcode[2],
            this.formatExpression(opcode[3]),
            opcode[4] ? this.formatExpression(opcode[4]) : undefined,
          ];
        case Op.OpenElement:
          return ['open-element', inflateTagName(opcode[1])];
        case Op.OpenElementWithSplat:
          return ['open-element-with-splat', inflateTagName(opcode[1])];
        case Op.CloseElement:
          return ['close-element'];
        case Op.FlushElement:
          return ['flush-element'];
        case Op.StaticAttr:
          return ['static-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];
        case Op.StaticComponentAttr:
          return ['static-component-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];
        case Op.DynamicAttr:
          return [
            'dynamic-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];
        case Op.ComponentAttr:
          return [
            'component-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];
        case Op.AttrSplat:
          return ['attr-splat'];
        case Op.Yield:
          return ['yield', opcode[1], this.formatParams(opcode[2])];
        case Op.DynamicArg:
          return ['dynamic-arg', opcode[1], this.formatOpcode(opcode[2])];
        case Op.StaticArg:
          return ['static-arg', opcode[1], this.formatOpcode(opcode[2])];
        case Op.TrustingDynamicAttr:
          return [
            'trusting-dynamic-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];
        case Op.TrustingComponentAttr:
          return [
            'trusting-component-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];
        case Op.Debugger:
          return ['debugger', opcode[1]];
        case Op.Comment:
          return ['comment', opcode[1]];
        case Op.AppendHtmlText:
          return opcode[1];
        case Op.LexicalModifier:
          return ['{{ <modifier> }}', this.formatLexical(opcode[1]), ...this.formatArgs(opcode[2])];
        case Op.ResolvedModifier:
          return [
            '{{ <resolved:modifier> }}',
            this.formatResolved(opcode[1]),
            ...this.formatArgs(opcode[2]),
          ];
        case Op.DynamicModifier:
          return ['{{ <modifier> }}', this.formatOpcode(opcode[1]), this.formatArgs(opcode[2])];
        case Op.If: {
          const condition = [this.formatOpcode(opcode[1])];
          const block = this.formatBlock(opcode[2]);
          const inverse = opcode[3] ? this.formatBlock(opcode[3]) : null;
          // Extract block params if present (though if blocks typically don't have params)
          if (
            Array.isArray(block) &&
            block.length === 2 &&
            typeof block[0] === 'object' &&
            block[0] !== null &&
            'as' in block[0]
          ) {
            const statements = block[1];
            if (inverse) {
              return ['!if', condition, statements, inverse];
            } else {
              return ['!if', condition, statements];
            }
          } else {
            if (inverse) {
              return ['!if', condition, block, inverse];
            } else {
              return ['!if', condition, block];
            }
          }
        }
        case Op.Each: {
          const iterable = [this.formatOpcode(opcode[1])];
          const block = this.formatBlock(opcode[3]);
          const inverse = opcode[4] ? this.formatBlock(opcode[4]) : null;
          // For test DSL, we need to merge key and block params into a single hash
          let hash: { key?: unknown; as?: string | string[] } = {};
          if (opcode[2]) {
            hash.key = this.formatOpcode(opcode[2]);
          }
          // Extract block params from the formatted block
          if (
            Array.isArray(block) &&
            block.length === 2 &&
            typeof block[0] === 'object' &&
            block[0] !== null &&
            'as' in block[0]
          ) {
            hash.as = (block[0] as { as: string | string[] }).as;
            // Return just the statements part
            const statements = block[1];
            if (Object.keys(hash).length > 0) {
              return inverse
                ? ['!each', iterable, hash, statements, inverse]
                : ['!each', iterable, hash, statements];
            } else {
              return inverse
                ? ['!each', iterable, statements, inverse]
                : ['!each', iterable, statements];
            }
          } else {
            if (Object.keys(hash).length > 0) {
              return inverse
                ? ['!each', iterable, hash, block, inverse]
                : ['!each', iterable, hash, block];
            } else {
              return inverse ? ['!each', iterable, block, inverse] : ['!each', iterable, block];
            }
          }
        }
        case Op.Let: {
          const params = this.formatParams(opcode[1]);
          const block = this.formatBlock(opcode[2]);
          // Ensure params is always an array
          const paramsArray = Array.isArray(params) ? params : [params];
          // Extract block params for test DSL format
          if (
            Array.isArray(block) &&
            block.length === 2 &&
            typeof block[0] === 'object' &&
            block[0] !== null &&
            'as' in block[0]
          ) {
            const hash = { as: (block[0] as { as: string | string[] }).as };
            const statements = block[1];
            return ['!let', paramsArray, hash, statements];
          } else {
            return ['!let', paramsArray, block];
          }
        }
        case Op.WithDynamicVars:
          return ['-with-dynamic-vars', this.formatHash(opcode[1]), this.formatBlock(opcode[2])];
        case Op.InvokeLexicalComponent:
          return ['component', this.formatLexical(opcode[1]), this.formatComponentArgs(opcode[2])];
        case Op.InvokeComponentKeyword:
          return [
            '{{component ...}}',
            this.formatOpcode(opcode[1]),
            this.formatBlockArgs(opcode[2]),
          ];
        case Op.InvokeDynamicBlock: {
          const [, path, args] = opcode;
          return ['{{# <block> }}', this.formatOpcode(path), this.formatBlockArgs(args)];
        }
        case Op.InvokeDynamicComponent: {
          const [, path, args] = opcode;
          return ['< {component} >', this.formatOpcode(path), this.formatComponentArgs(args)];
        }
        case Op.InvokeResolvedComponent: {
          const [, path, args] = opcode;
          return [
            '< {component:resolved} >',
            this.formatResolved(path),
            this.formatComponentArgs(args),
          ];
        }
        case Op.AppendResolvedInvokableCautiously: {
          const [, callee, args] = opcode;
          // Format as DSL: [BUILDER_APPEND, ['(^helper)', args...]]
          const helper = this.formatResolved(callee);
          const formattedArgs = this.formatArgsForAppend(args);
          return [BUILDER_APPEND, [`(^${helper})`, ...formattedArgs]];
        }
        case Op.AppendTrustedResolvedInvokable: {
          const [, callee, args] = opcode;
          return [
            '{{{ <invoke:resolved> }}}',
            this.formatResolved(callee),
            ...this.formatArgs(args),
          ];
        }
        case Op.AppendStatic:
          return ['append:static', opcode[1]];
        case Op.AppendInvokableCautiously:
          return ['{{ <invoke> }}', this.formatOpcode(opcode[1]), ...this.formatArgs(opcode[2])];
        case Op.AppendResolvedValueCautiously:
          return ['{{ <append:resolved> }}', this.formatResolved(opcode[1])];
        case Op.AppendTrustedInvokable:
          return ['{{{ <invoke> }}}', this.formatOpcode(opcode[1]), ...this.formatArgs(opcode[2])];
        case Op.AppendTrustedResolvedHtml:
          return ['{{{ <append:resolved> }}}', this.formatResolved(opcode[1])];
        default:
          return ['unknown-opcode', opcode];
      }
    } else {
      return opcode;
    }
  }

  private formatLexical(symbol: number) {
    return `^${this.lexicalSymbols[symbol]}`;
  }

  private formatResolved(symbol: number) {
    return this.upvars[symbol];
  }

  private formatArgsToArray(args: Optional<WireFormat.Core.CallArgs | WireFormat.Core.BlockArgs>) {
    const positional = args && hasPositional(args) ? getPositional(args) : undefined;
    const named = args && hasNamed(args) ? getNamed(args) : undefined;

    if (positional && named) {
      return [...this.formatParams(positional), this.formatHash(named)];
    } else if (positional) {
      return this.formatParams(positional);
    } else if (named) {
      return [this.formatHash(named)];
    } else {
      return [];
    }
  }

  private formatArgs(args: Optional<WireFormat.Core.CallArgs>): unknown[] {
    if (!args) return [];

    const formatted = [];

    if (hasPositional(args)) {
      formatted.push(...this.formatParams(getPositional(args)));
    }

    if (hasNamed(args)) {
      formatted.push(this.formatHash(getNamed(args)));
    }

    return formatted;
  }

  private formatArgsForAppend(args: Optional<WireFormat.Core.CallArgs>): unknown[] {
    if (!args) return [];

    const formatted = [];

    if (hasPositional(args)) {
      const params = getPositional(args).map((param) => {
        // Check if this parameter is a helper call
        if (this.isHelperCall(param)) {
          const helper = this.formatHelperCall(param);
          // For nested helpers in append context, return just the helper name
          if (
            Array.isArray(helper) &&
            helper.length > 0 &&
            typeof helper[0] === 'string' &&
            helper[0].startsWith('(^')
          ) {
            return helper[0];
          }
          return helper;
        }
        return this.formatOpcode(param);
      });
      formatted.push(...params);
    }

    if (hasNamed(args)) {
      formatted.push(this.formatHash(getNamed(args)));
    }

    return formatted;
  }

  private formatComponentArgs(args: Optional<WireFormat.Core.BlockArgs>) {
    if (!args) return;

    const formatted: { splattributes?: object; args?: unknown[]; blocks?: object } = {};

    const blocks = hasBlocks(args) ? getBlocks(args) : undefined;

    if (blocks) {
      const attrs = blocks[0].findIndex((name) => name === 'attrs');

      if (attrs > -1) {
        const splattributes = blocks[1][attrs] as SerializedInlineBlock;
        formatted.splattributes = this.formatBlock(splattributes);
        blocks[0].splice(attrs, 1);
        blocks[1].splice(attrs, 1);
      }
    }

    const argList = this.formatArgsToArray(args);

    if (argList.length > 0) {
      formatted.args = argList;
    }

    if (blocks) {
      formatted.blocks = this.formatBlocks(blocks);
    }

    return formatted;
  }

  private formatBlockArgs(args: Optional<WireFormat.Core.BlockArgs>) {
    if (!args) return;

    const formatted: unknown[] = [];

    formatted.push(...this.formatArgsToArray(args));

    if (hasBlocks(args)) {
      formatted.push(this.formatBlocks(getBlocks(args)));
    }

    return formatted;
  }

  private formatParams(opcodes: WireFormat.Core.Params): unknown[];
  private formatParams(opcodes: Optional<WireFormat.Core.Params>): Optional<unknown[]>;
  private formatParams(opcodes: Optional<WireFormat.Core.Params>): Optional<unknown[]> {
    if (!opcodes) return [];
    return opcodes.map((o) => this.formatOpcode(o));
  }

  private formatAppendExpression(expr: WireFormat.Expression): unknown {
    return this.formatOpcode(expr);
  }

  private formatHash(hash: WireFormat.Core.Hash): object;
  private formatHash(hash: Optional<WireFormat.Core.Hash>): Optional<object>;
  private formatHash(hash: Optional<WireFormat.Core.Hash>): Optional<object> {
    if (!hash) return;

    return hash[0].reduce((accum, key, index) => {
      accum[key] = this.formatOpcode(hash[1][index]);
      return accum;
    }, dict());
  }

  private formatBlocks(blocks: WireFormat.Core.Blocks): object;
  private formatBlocks(blocks: Optional<WireFormat.Core.Blocks>): Optional<object>;
  private formatBlocks(blocks: Optional<WireFormat.Core.Blocks>): Optional<object> {
    if (!blocks) return;

    return blocks[0].reduce((accum, key, index) => {
      accum[key] = this.formatBlock(blocks[1][index] as SerializedInlineBlock);
      return accum;
    }, dict());
  }

  private formatBlock(
    block: SerializedInlineBlock
  ): unknown[] | [{ as: string | string[] }, unknown[]] {
    const [statements, parameters] = block;

    if (parameters.length === 0) {
      return statements.map((s) => this.formatOpcode(s));
    } else {
      // Resolve parameter indices to their string names
      const resolvedParams = parameters.map((idx) => this.symbols[idx]);
      // For test DSL compatibility, single params should be a string, not an array
      const as = resolvedParams.length === 1 ? resolvedParams[0] : resolvedParams;
      return [{ as }, statements.map((s) => this.formatOpcode(s))];
    }
  }
}

const hasPositional = <T extends WireFormat.Core.SomeArgs>(
  args: T
): args is T & WireFormat.Core.HasPositionalArgs =>
  !!(args[0] & (0b100 satisfies HasPositionalArgsFlag));

export const getPositional = (args: WireFormat.Core.HasPositionalArgs): WireFormat.Core.Params =>
  args[1];

export const hasNamed = <T extends WireFormat.Core.SomeArgs>(
  args: T
): args is T & WireFormat.Core.HasNamedArgs => !!(args[0] & (0b010 satisfies HasNamedArgsFlag));

export const getNamed = (args: WireFormat.Core.HasNamedArgs): WireFormat.Core.Hash => {
  switch (args[0]) {
    case NAMED_ARGS_OPCODE:
    case NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[1];
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
    case POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[2];
    default:
      exhausted(args);
  }
};

export const hasBlocks = <T extends WireFormat.Core.BlockArgs>(
  args: T
): args is T & WireFormat.Core.HasBlocks => !!(args[0] & (0b001 satisfies HasBlocksFlag));

export const getBlocks = (args: WireFormat.Core.HasBlocks): WireFormat.Core.Blocks => {
  switch (args[0]) {
    case BLOCKS_OPCODE:
      return args[1];
    case POSITIONAL_AND_BLOCKS_OPCODE:
    case NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[2];
    case POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[3];
    default:
      exhausted(args);
  }
};

function isTuple(
  syntax: WireFormat.Syntax
): syntax is Exclude<WireFormat.Syntax, WireFormat.Expressions.Value | undefined> {
  return Array.isArray(syntax);
}

function isSimple(syntax: WireFormat.Syntax): syntax is WireFormat.Expressions.SimpleStackOp {
  return typeof syntax === 'number';
}
