import type {
  CurriedType,
  Nullable,
  SerializedInlineBlock,
  SerializedTemplateBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { dict } from '@glimmer/util';
import {
  WF_APPEND_OPCODE,
  WF_ATTR_SPLAT_OPCODE,
  WF_BLOCK_OPCODE,
  WF_CALL_OPCODE,
  WF_CLOSE_ELEMENT_OPCODE,
  WF_COMMENT_OPCODE,
  WF_COMPONENT_ATTR_OPCODE,
  WF_COMPONENT_OPCODE,
  WF_CONCAT_OPCODE,
  WF_CURRY_OPCODE,
  WF_DEBUGGER_OPCODE,
  WF_DYNAMIC_ARG_OPCODE,
  WF_DYNAMIC_ATTR_OPCODE,
  WF_EACH_OPCODE,
  WF_FLUSH_ELEMENT_OPCODE,
  WF_GET_DYNAMIC_VAR_OPCODE,
  WF_GET_FREE_AS_COMPONENT_HEAD_OPCODE,
  WF_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OPCODE,
  WF_GET_FREE_AS_HELPER_HEAD_OPCODE,
  WF_GET_FREE_AS_MODIFIER_HEAD_OPCODE,
  WF_GET_LEXICAL_SYMBOL_OPCODE,
  WF_GET_STRICT_KEYWORD_OPCODE,
  WF_GET_SYMBOL_OPCODE,
  WF_HAS_BLOCK_OPCODE,
  WF_HAS_BLOCK_PARAMS_OPCODE,
  WF_IF_INLINE_OPCODE,
  WF_IF_OPCODE,
  WF_IN_ELEMENT_OPCODE,
  WF_INVOKE_COMPONENT_OPCODE,
  WF_LET_OPCODE,
  WF_LOG_OPCODE,
  WF_MODIFIER_OPCODE,
  WF_NOT_OPCODE,
  WF_OPEN_ELEMENT_OPCODE,
  WF_OPEN_ELEMENT_WITH_SPLAT_OPCODE,
  WF_STATIC_ARG_OPCODE,
  WF_STATIC_ATTR_OPCODE,
  WF_STATIC_COMPONENT_ATTR_OPCODE,
  WF_TRUSTING_APPEND_OPCODE,
  WF_TRUSTING_COMPONENT_ATTR_OPCODE,
  WF_TRUSTING_DYNAMIC_ATTR_OPCODE,
  WF_UNDEFINED_OPCODE,
  WF_WITH_DYNAMIC_VARS_OPCODE,
  WF_YIELD_OPCODE,
} from '@glimmer/wire-format';

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
        case WF_APPEND_OPCODE:
          return ['append', this.formatOpcode(opcode[1])];
        case WF_TRUSTING_APPEND_OPCODE:
          return ['trusting-append', this.formatOpcode(opcode[1])];

        case WF_BLOCK_OPCODE:
          return [
            'block',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
            this.formatBlocks(opcode[4]),
          ];

        case WF_IN_ELEMENT_OPCODE:
          return [
            'in-element',
            opcode[1],
            this.formatOpcode(opcode[2]),
            opcode[3] ? this.formatOpcode(opcode[3]) : undefined,
          ];

        case WF_OPEN_ELEMENT_OPCODE:
          return ['open-element', inflateTagName(opcode[1])];

        case WF_OPEN_ELEMENT_WITH_SPLAT_OPCODE:
          return ['open-element-with-splat', inflateTagName(opcode[1])];

        case WF_CLOSE_ELEMENT_OPCODE:
          return ['close-element'];

        case WF_FLUSH_ELEMENT_OPCODE:
          return ['flush-element'];

        case WF_STATIC_ATTR_OPCODE:
          return ['static-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];

        case WF_STATIC_COMPONENT_ATTR_OPCODE:
          return ['static-component-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];

        case WF_DYNAMIC_ATTR_OPCODE:
          return [
            'dynamic-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WF_COMPONENT_ATTR_OPCODE:
          return [
            'component-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WF_ATTR_SPLAT_OPCODE:
          return ['attr-splat'];

        case WF_YIELD_OPCODE:
          return ['yield', opcode[1], this.formatParams(opcode[2])];

        case WF_DYNAMIC_ARG_OPCODE:
          return ['dynamic-arg', opcode[1], this.formatOpcode(opcode[2])];

        case WF_STATIC_ARG_OPCODE:
          return ['static-arg', opcode[1], this.formatOpcode(opcode[2])];

        case WF_TRUSTING_DYNAMIC_ATTR_OPCODE:
          return [
            'trusting-dynamic-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WF_TRUSTING_COMPONENT_ATTR_OPCODE:
          return [
            'trusting-component-attr',
            inflateAttrName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WF_DEBUGGER_OPCODE:
          return ['debugger', opcode[1]];

        case WF_COMMENT_OPCODE:
          return ['comment', opcode[1]];

        case WF_MODIFIER_OPCODE:
          return [
            'modifier',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
          ];

        case WF_COMPONENT_OPCODE:
          return [
            'component',
            this.formatOpcode(opcode[1]),
            this.formatElementParams(opcode[2]),
            this.formatHash(opcode[3]),
            this.formatBlocks(opcode[4]),
          ];

        case WF_HAS_BLOCK_OPCODE:
          return ['has-block', this.formatOpcode(opcode[1])];

        case WF_HAS_BLOCK_PARAMS_OPCODE:
          return ['has-block-params', this.formatOpcode(opcode[1])];

        case WF_CURRY_OPCODE:
          return [
            'curry',
            this.formatOpcode(opcode[1]),
            this.formatCurryType(opcode[2]),
            this.formatParams(opcode[3]),
            this.formatHash(opcode[4]),
          ];

        case WF_UNDEFINED_OPCODE:
          return ['undefined'];

        case WF_CALL_OPCODE:
          return [
            'call',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
          ];

        case WF_CONCAT_OPCODE:
          return ['concat', this.formatParams(opcode[1] as WireFormat.Core.Params)];

        case WF_GET_STRICT_KEYWORD_OPCODE:
          return ['get-strict-keyword', this.upvars[opcode[1]]];

        case WF_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OPCODE:
          return ['GetFreeAsComponentOrHelperHead', this.upvars[opcode[1]], opcode[2]];

        case WF_GET_FREE_AS_HELPER_HEAD_OPCODE:
          return ['GetFreeAsHelperHead', this.upvars[opcode[1]], opcode[2]];

        case WF_GET_FREE_AS_COMPONENT_HEAD_OPCODE:
          return ['GetFreeAsComponentHead', this.upvars[opcode[1]], opcode[2]];

        case WF_GET_FREE_AS_MODIFIER_HEAD_OPCODE:
          return ['GetFreeAsModifierHead', this.upvars[opcode[1]], opcode[2]];

        case WF_GET_SYMBOL_OPCODE: {
          if (opcode[1] === 0) {
            return ['get-symbol', 'this', opcode[2]];
          } else {
            return ['get-symbol', this.symbols[opcode[1] - 1], opcode[2]];
          }
        }

        case WF_GET_LEXICAL_SYMBOL_OPCODE: {
          return ['get-lexical-symbol', opcode[1], opcode[2]];
        }

        case WF_IF_OPCODE:
          return [
            'if',
            this.formatOpcode(opcode[1]),
            this.formatBlock(opcode[2]),
            opcode[3] ? this.formatBlock(opcode[3]) : null,
          ];

        case WF_IF_INLINE_OPCODE:
          return ['if-inline'];

        case WF_NOT_OPCODE:
          return ['not'];

        case WF_EACH_OPCODE:
          return [
            'each',
            this.formatOpcode(opcode[1]),
            opcode[2] ? this.formatOpcode(opcode[2]) : null,
            this.formatBlock(opcode[3]),
            opcode[4] ? this.formatBlock(opcode[4]) : null,
          ];

        case WF_LET_OPCODE:
          return ['let', this.formatParams(opcode[1]), this.formatBlock(opcode[2])];

        case WF_LOG_OPCODE:
          return ['log', this.formatParams(opcode[1])];

        case WF_WITH_DYNAMIC_VARS_OPCODE:
          return ['-with-dynamic-vars', this.formatHash(opcode[1]), this.formatBlock(opcode[2])];

        case WF_GET_DYNAMIC_VAR_OPCODE:
          return ['-get-dynamic-vars', this.formatOpcode(opcode[1])];

        case WF_INVOKE_COMPONENT_OPCODE:
          return [
            'component',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
            this.formatBlocks(opcode[4]),
          ];
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
    opcodes: Nullable<WireFormat.ElementParameter[]>
  ): Nullable<unknown[]> {
    if (opcodes === null) return null;
    return opcodes.map((o) => this.formatOpcode(o));
  }

  private formatParams(opcodes: Nullable<WireFormat.Expression[]>): Nullable<unknown[]> {
    if (opcodes === null) return null;
    return opcodes.map((o) => this.formatOpcode(o));
  }

  private formatHash(hash: WireFormat.Core.Hash): Nullable<object> {
    if (hash === null) return null;

    return hash[0].reduce((accum, key, index) => {
      accum[key] = this.formatOpcode(hash[1][index]);
      return accum;
    }, dict());
  }

  private formatBlocks(blocks: WireFormat.Core.Blocks): Nullable<object> {
    if (blocks === null) return null;

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
