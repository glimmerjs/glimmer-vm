import type {
  CurriedType,
  Optional,
  SerializedInlineBlock,
  SerializedTemplateBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { dict } from '@glimmer/util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import { inflateAttrName, inflateTagName } from './utils';

export default class WireFormatDebugger {
  private upvars: string[];
  private symbols: string[];

  constructor([_statements, symbols, upvars]: SerializedTemplateBlock) {
    this.upvars = upvars;
    this.symbols = symbols;
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
        case Op.Append:
          return ['append', this.formatOpcode(opcode[1])];
        case Op.AppendTrustedHtml:
          return ['trusting-append', this.formatOpcode(opcode[1])];

        case Op.ResolvedBlock:
          return ['block', this.formatOpcode(opcode[1]), this.formatBlockArgs(opcode[2])];

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

        case Op.LexicalModifier:
        case Op.ResolvedModifier:
          return [
            opcode[0] === Op.ResolvedModifier ? 'modifier:resolved' : 'modifier',
            this.formatOpcode(opcode[1]),
            this.formatArgs(opcode[2]),
          ];

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
        case Op.CallLexical:
          return [
            opcode[0] === Op.CallResolved ? 'call:resolved' : 'call',
            this.formatOpcode(opcode[1]),
            this.formatArgs(opcode[2]),
          ];

        case Op.Concat:
          return ['concat', this.formatParams(opcode[1])];

        case Op.GetStrictKeyword:
          return ['get-strict-free', this.upvars[opcode[1]]];

        case Op.GetFreeAsComponentOrHelperHead:
          return ['GetFreeAsComponentOrHelperHead', this.upvars[opcode[1]], opcode[2]];

        case Op.GetFreeAsHelperHead:
          return ['GetFreeAsHelperHead', this.upvars[opcode[1]], opcode[2]];

        case Op.GetFreeAsComponentHead:
          return ['GetFreeAsComponentHead', this.upvars[opcode[1]], opcode[2]];

        case Op.GetFreeAsModifierHead:
          return ['GetFreeAsModifierHead', this.upvars[opcode[1]], opcode[2]];

        case Op.GetLocalSymbol: {
          if (opcode[1] === 0) {
            return ['get-symbol', 'this', opcode[2]];
          } else {
            return ['get-symbol', this.symbols[opcode[1] - 1], opcode[2]];
          }
        }

        case Op.GetLexicalSymbol: {
          return ['get-template-symbol', opcode[1], opcode[2]];
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
          return ['component', this.formatOpcode(opcode[1]), this.formatComponentArgs(opcode[2])];

        case Op.InvokeComponentKeyword:
          return [
            'component:keyword',
            this.formatOpcode(opcode[1]),
            this.formatBlockArgs(opcode[2]),
          ];

        case Op.DynamicBlock: {
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

        case Op.AppendResolved:
          return ['append:resolved-component', this.formatOpcode(opcode[1])];

        case Op.AppendResolvedHelper:
          return ['append:resolved-helper', this.formatOpcode(opcode[1])];

        case Op.AppendBuiltinHelper:
          return ['append:builtin-helper', this.formatOpcode(opcode[1])];

        case Op.UnknownAppend:
        case Op.UnknownTrustingAppend:
          return [
            opcode[0] === Op.UnknownTrustingAppend ? 'append:trusting' : 'append',
            this.formatOpcode(opcode[1]),
          ];

        case Op.AppendStatic:
          return ['append:static', this.formatOpcode(opcode[1])];

        case Op.AppendLexical:
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

  private formatElementParams(
    opcodes: Optional<WireFormat.Core.Splattributes>
  ): Optional<unknown[]> {
    if (!opcodes) return;
    return opcodes.map((o) => this.formatOpcode(o));
  }

  private formatArgs(args: Optional<WireFormat.Core.Args>) {
    if (!args) return;

    const params = this.formatParams(args.params);
    const hash = this.formatHash(args.hash);

    return { params, hash };
  }

  private formatComponentArgs(args: Optional<WireFormat.Core.ComponentArgs>) {
    if (!args) return;

    const splattributes = this.formatElementParams(args.splattributes);
    const hash = this.formatHash(args.hash);
    const blocks = this.formatBlocks(args.blocks);

    return { splattributes, hash, blocks };
  }

  private formatBlockArgs(args: Optional<WireFormat.Core.BlockArgs>) {
    if (!args) return;

    const params = this.formatParams(args.params);
    const hash = this.formatHash(args.hash);
    const blocks = this.formatBlocks(args.blocks);

    return {
      params,
      hash,
      blocks,
    };
  }

  private formatParams(opcodes: Optional<WireFormat.Core.Params>): Optional<unknown[]> {
    if (!opcodes) return;
    return opcodes.map((o) => this.formatOpcode(o));
  }

  private formatHash(hash: Optional<WireFormat.Core.Hash>): Optional<object> {
    if (!hash) return;

    return hash[0].reduce((accum, key, index) => {
      accum[key] = this.formatOpcode(hash[1][index]);
      return accum;
    }, dict());
  }

  private formatBlocks(blocks: Optional<WireFormat.Core.Blocks>): Optional<object> {
    if (!blocks) return;

    return blocks[0].reduce((accum, key, index) => {
      accum[key] = this.formatBlock(blocks[1][index] as SerializedInlineBlock);
      return accum;
    }, dict());
  }

  private formatBlock(block: SerializedInlineBlock): object {
    return {
      statements: block[0].map((s) => this.formatOpcode(s)),
      parameters: block[1],
    };
  }
}
