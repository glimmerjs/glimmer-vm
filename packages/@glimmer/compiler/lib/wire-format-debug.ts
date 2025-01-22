import type {
  CurriedType,
  HasBlocksFlag,
  HasNamedArgsFlag,
  HasPositionalArgsFlag,
  Optional,
  SerializedInlineBlock,
  SerializedTemplateBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';
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

  formatOpcode(opcode: WireFormat.Syntax): unknown {
    if (Array.isArray(opcode)) {
      switch (opcode[0]) {
        case Op.AppendValueCautiously:
          return ['append', this.formatOpcode(opcode[1])];
        case Op.AppendTrustedHtml:
          return ['trusting-append', this.formatOpcode(opcode[1])];

        case Op.InElement:
          return [
            'in-element',
            opcode[1],
            this.formatOpcode(opcode[2]),
            opcode[3] ? this.formatOpcode(opcode[3]) : undefined,
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
          return ['html-text', opcode[1]];

        case Op.LexicalModifier:
          return ['modifier', this.formatLexical(opcode[1]), this.formatArgs(opcode[2])];

        case Op.ResolvedModifier:
          return [
            'modifier',
            this.formatResolved(opcode[1], 'modifier'),
            this.formatArgs(opcode[2]),
          ];

        case Op.DynamicModifier:
          return ['modifier', this.formatOpcode(opcode[1]), this.formatArgs(opcode[2])];

        case Op.HasBlock:
          return ['has-block', this.formatOpcode(opcode[1])];

        case Op.HasBlockParams:
          return ['has-block-params', this.formatOpcode(opcode[1])];

        case Op.Curry:
          return [
            'curry',
            this.formatOpcode(opcode[1]),
            this.formatCurryType(opcode[2]),
            this.formatArgs(opcode[3]),
          ];

        case Op.Undefined:
          return ['undefined'];

        case Op.CallResolved:
          return ['call:resolved', this.upvars[opcode[1]], this.formatArgs(opcode[2])];

        case Op.CallDynamicValue:
          return ['call', this.formatOpcode(opcode[1]), this.formatArgs(opcode[2])];

        case Op.Concat:
          return ['concat', this.formatParams(opcode[1])];

        case Op.GetKeyword:
          return ['get-strict-free', this.upvars[opcode[1]]];

        case Op.GetPath:
          return ['get-path', this.formatOpcode([opcode[1], opcode[2]]), opcode[3]];

        case Op.GetLocalSymbol: {
          if (opcode[1] === 0) {
            return ['get-symbol', 'this'];
          } else {
            return ['get-symbol', this.symbols[opcode[1] - 1]];
          }
        }

        case Op.GetLexicalSymbol: {
          return ['get-lexical-symbol', opcode[1]];
        }

        case Op.If:
          return [
            'if',
            this.formatOpcode(opcode[1]),
            this.formatBlock(opcode[2]),
            opcode[3] ? this.formatBlock(opcode[3]) : null,
          ];

        case Op.IfInline:
          return ['if-inline'];

        case Op.Not:
          return ['not'];

        case Op.Each:
          return [
            'each',
            this.formatOpcode(opcode[1]),
            opcode[2] ? this.formatOpcode(opcode[2]) : null,
            this.formatBlock(opcode[3]),
            opcode[4] ? this.formatBlock(opcode[4]) : null,
          ];

        case Op.Let:
          return ['let', this.formatParams(opcode[1]), this.formatBlock(opcode[2])];

        case Op.Log:
          return ['log', this.formatParams(opcode[1])];

        case Op.WithDynamicVars:
          return ['-with-dynamic-vars', this.formatHash(opcode[1]), this.formatBlock(opcode[2])];

        case Op.GetDynamicVar:
          return ['-get-dynamic-vars', this.formatOpcode(opcode[1])];

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
          return ['block', this.formatOpcode(path), this.formatBlockArgs(args)];
        }

        case Op.InvokeDynamicComponent:
        case Op.InvokeResolvedComponent: {
          const [op, path, args] = opcode;
          return [
            op === Op.InvokeResolvedComponent ? 'component:resolved' : 'component',
            this.formatOpcode(path),
            this.formatComponentArgs(args),
          ];
        }

        case Op.AppendResolvedInvokableCautiously: {
          const [, callee, args] = opcode;
          return [
            '{{ <invokable> }}',
            this.formatResolved(callee, 'invokable'),
            this.formatArgs(args),
          ];
        }

        case Op.AppendTrustedResolvedInvokable: {
          const [, callee, args] = opcode;
          return [
            '{{{ <invokable> }}}',
            this.formatResolved(callee, 'invokable'),
            this.formatArgs(args),
          ];
        }

        case Op.AppendStatic:
          return ['append:static', this.formatOpcode(opcode[1])];

        case Op.AppendDynamicInvokable:
          return ['append:lexical', this.formatOpcode(opcode[1])];

        default:
          exhausted(opcode);
      }
    } else {
      return opcode;
    }
  }

  private formatCurryType(value: CurriedType) {
    switch (value) {
      case CURRIED_COMPONENT:
        return 'component';
      case CURRIED_HELPER:
        return 'helper';
      case CURRIED_MODIFIER:
        return 'modifier';
      default:
        exhausted(value);
    }
  }

  private formatLexical(symbol: number) {
    return `^${this.lexicalSymbols[symbol]}`;
  }

  private formatResolved(symbol: number, kind: string) {
    return `${kind}:${this.upvars[symbol]}`;
  }

  private formatElementParams(
    opcodes: Optional<WireFormat.Core.Splattributes>
  ): Optional<unknown[]> {
    if (!opcodes) return;
    return opcodes.map((o) => this.formatOpcode(o));
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

  private formatArgs(args: Optional<WireFormat.Core.CallArgs>) {
    if (!args) return;

    const formatted = [];

    if (hasPositional(args)) {
      formatted.push(...this.formatParams(getPositional(args)));
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
    if (!opcodes) return;
    return opcodes.map((o) => this.formatOpcode(o));
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

  private formatBlock(block: SerializedInlineBlock): object {
    const [statements, parameters] = block;

    if (parameters.length === 0) {
      return statements.map((s) => this.formatOpcode(s));
    } else {
      return [{ as: parameters }, statements.map((s) => this.formatOpcode(s))];
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
