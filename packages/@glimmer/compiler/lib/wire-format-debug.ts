import type {
  CurriedType,
  Nullable,
  SerializedInlineBlock,
  SerializedTemplateBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { dict, exhausted } from '@glimmer/util';

import { inflateAttrName as inflateAttributeName, inflateTagName } from './utils';
import { CURRIED_COMPONENT, CURRIED_HELPER, CURRIED_MODIFIER } from '@glimmer/vm-constants';
import {
  WIRE_APPEND,
  WIRE_ATTR_SPLAT,
  WIRE_BLOCK,
  WIRE_CALL,
  WIRE_CLOSE_ELEMENT,
  WIRE_COMMENT,
  WIRE_COMPONENT,
  WIRE_COMPONENT_ATTR,
  WIRE_CONCAT,
  WIRE_CURRY,
  WIRE_DEBUGGER,
  WIRE_DYNAMIC_ARG,
  WIRE_DYNAMIC_ATTR,
  WIRE_EACH,
  WIRE_FLUSH_ELEMENT,
  WIRE_GET_DYNAMIC_VAR,
  WIRE_GET_FREE_AS_COMPONENT_HEAD,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_HELPER_HEAD,
  WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_MODIFIER_HEAD,
  WIRE_GET_LEXICAL_SYMBOL,
  WIRE_GET_STRICT_KEYWORD,
  WIRE_GET_SYMBOL,
  WIRE_HAS_BLOCK,
  WIRE_HAS_BLOCK_PARAMS,
  WIRE_IF,
  WIRE_IF_INLINE,
  WIRE_INVOKE_COMPONENT,
  WIRE_IN_ELEMENT,
  WIRE_LET,
  WIRE_LOG,
  WIRE_MODIFIER,
  WIRE_NOT,
  WIRE_OPEN_ELEMENT,
  WIRE_OPEN_ELEMENT_WITH_SPLAT,
  WIRE_STATIC_ARG,
  WIRE_STATIC_ATTR,
  WIRE_STATIC_COMPONENT_ATTR,
  WIRE_TRUSTING_APPEND,
  WIRE_TRUSTING_COMPONENT_ATTR,
  WIRE_TRUSTING_DYNAMIC_ATTR,
  WIRE_UNDEFINED,
  WIRE_WITH,
  WIRE_WITH_DYNAMIC_VARS,
  WIRE_YIELD,
} from '@glimmer/wire-format';

export default class WireFormatDebugger {
  private upvars: string[];
  private symbols: string[];

  constructor([_statements, symbols, _hasEval, upvars]: SerializedTemplateBlock) {
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
        case WIRE_APPEND:
          return ['append', this.formatOpcode(opcode[1])];
        case WIRE_TRUSTING_APPEND:
          return ['trusting-append', this.formatOpcode(opcode[1])];

        case WIRE_BLOCK:
          return [
            'block',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
            this.formatBlocks(opcode[4]),
          ];

        case WIRE_IN_ELEMENT:
          return [
            'in-element',
            opcode[1],
            this.formatOpcode(opcode[2]),
            opcode[3] ? this.formatOpcode(opcode[3]) : undefined,
          ];

        case WIRE_OPEN_ELEMENT:
          return ['open-element', inflateTagName(opcode[1])];

        case WIRE_OPEN_ELEMENT_WITH_SPLAT:
          return ['open-element-with-splat', inflateTagName(opcode[1])];

        case WIRE_CLOSE_ELEMENT:
          return ['close-element'];

        case WIRE_FLUSH_ELEMENT:
          return ['flush-element'];

        case WIRE_STATIC_ATTR:
          return ['static-attr', inflateAttributeName(opcode[1]), opcode[2], opcode[3]];

        case WIRE_STATIC_COMPONENT_ATTR:
          return ['static-component-attr', inflateAttributeName(opcode[1]), opcode[2], opcode[3]];

        case WIRE_DYNAMIC_ATTR:
          return [
            'dynamic-attr',
            inflateAttributeName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WIRE_COMPONENT_ATTR:
          return [
            'component-attr',
            inflateAttributeName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WIRE_ATTR_SPLAT:
          return ['attr-splat'];

        case WIRE_YIELD:
          return ['yield', opcode[1], this.formatParams(opcode[2])];

        case WIRE_DYNAMIC_ARG:
          return ['dynamic-arg', opcode[1], this.formatOpcode(opcode[2])];

        case WIRE_STATIC_ARG:
          return ['static-arg', opcode[1], this.formatOpcode(opcode[2])];

        case WIRE_TRUSTING_DYNAMIC_ATTR:
          return [
            'trusting-dynamic-attr',
            inflateAttributeName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WIRE_TRUSTING_COMPONENT_ATTR:
          return [
            'trusting-component-attr',
            inflateAttributeName(opcode[1]),
            this.formatOpcode(opcode[2]),
            opcode[3],
          ];

        case WIRE_DEBUGGER:
          return ['debugger', opcode[1]];

        case WIRE_COMMENT:
          return ['comment', opcode[1]];

        case WIRE_MODIFIER:
          return [
            'modifier',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
          ];

        case WIRE_COMPONENT:
          return [
            'component',
            this.formatOpcode(opcode[1]),
            this.formatElementParams(opcode[2]),
            this.formatHash(opcode[3]),
            this.formatBlocks(opcode[4]),
          ];

        case WIRE_HAS_BLOCK:
          return ['has-block', this.formatOpcode(opcode[1])];

        case WIRE_HAS_BLOCK_PARAMS:
          return ['has-block-params', this.formatOpcode(opcode[1])];

        case WIRE_CURRY:
          return [
            'curry',
            this.formatOpcode(opcode[1]),
            this.formatCurryType(opcode[2]),
            this.formatParams(opcode[3]),
            this.formatHash(opcode[4]),
          ];

        case WIRE_UNDEFINED:
          return ['undefined'];

        case WIRE_CALL:
          return [
            'call',
            this.formatOpcode(opcode[1]),
            this.formatParams(opcode[2]),
            this.formatHash(opcode[3]),
          ];

        case WIRE_CONCAT:
          return ['concat', this.formatParams(opcode[1] as WireFormat.Core.Params)];

        case WIRE_GET_STRICT_KEYWORD:
          return ['get-strict-free', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK:
          return [
            'GetFreeAsComponentOrHelperHeadOrThisFallback',
            this.upvars[opcode[1]],
            opcode[2],
          ];

        case WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD:
          return ['GetFreeAsComponentOrHelperHead', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK:
          return ['GetFreeAsHelperHeadOrThisFallback', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK:
          return ['GetFreeAsDeprecatedHelperHeadOrThisFallback', this.upvars[opcode[1]]];

        case WIRE_GET_FREE_AS_HELPER_HEAD:
          return ['GetFreeAsHelperHead', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_FREE_AS_COMPONENT_HEAD:
          return ['GetFreeAsComponentHead', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_FREE_AS_MODIFIER_HEAD:
          return ['GetFreeAsModifierHead', this.upvars[opcode[1]], opcode[2]];

        case WIRE_GET_SYMBOL:
          return opcode[1] === 0 ? ['get-symbol', 'this', opcode[2]] : ['get-symbol', this.symbols[opcode[1] - 1], opcode[2]];
        

        case WIRE_GET_LEXICAL_SYMBOL:
          return ['get-template-symbol', opcode[1], opcode[2]];
        

        case WIRE_IF:
          return [
            'if',
            this.formatOpcode(opcode[1]),
            this.formatBlock(opcode[2]),
            opcode[3] ? this.formatBlock(opcode[3]) : null,
          ];

        case WIRE_IF_INLINE:
          return ['if-inline'];

        case WIRE_NOT:
          return ['not'];

        case WIRE_EACH:
          return [
            'each',
            this.formatOpcode(opcode[1]),
            opcode[2] ? this.formatOpcode(opcode[2]) : null,
            this.formatBlock(opcode[3]),
            opcode[4] ? this.formatBlock(opcode[4]) : null,
          ];

        case WIRE_WITH:
          return [
            'with',
            this.formatOpcode(opcode[1]),
            this.formatBlock(opcode[2]),
            opcode[3] ? this.formatBlock(opcode[3]) : null,
          ];

        case WIRE_LET:
          return ['let', this.formatParams(opcode[1]), this.formatBlock(opcode[2])];

        case WIRE_LOG:
          return ['log', this.formatParams(opcode[1])];

        case WIRE_WITH_DYNAMIC_VARS:
          return ['-with-dynamic-vars', this.formatHash(opcode[1]), this.formatBlock(opcode[2])];

        case WIRE_GET_DYNAMIC_VAR:
          return ['-get-dynamic-vars', this.formatOpcode(opcode[1])];

        case WIRE_INVOKE_COMPONENT:
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
        throw exhausted(value);
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
