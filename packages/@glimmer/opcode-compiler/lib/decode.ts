import {
  Option,
  PresentArray,
  SerializedTemplateBlock,
  SexpOpcodes,
  WireFormat,
} from '@glimmer/interfaces';
import { assertPresent, toPresentOption } from '@glimmer/util';
import { packed, unpack } from '@glimmer/wire-format';
import { AttrNamespace } from '@simple-dom/interface';

import Op = SexpOpcodes;
import Expr = WireFormat.Expressions;
import Stmt = WireFormat.Statements;

export function decode(raw: string, encoder: 'default' | 'packed'): SerializedTemplateBlock {
  if (encoder === 'default') {
    return JSON.parse(raw);
  } else {
  }
  // let encoded = JSON.parse(raw) as packed.Template;
}

interface ContentOutput {
  content: WireFormat.Statement;
  Comment: WireFormat.Statements.Comment;
  Append: WireFormat.Statements.Append | WireFormat.Statements.TrustingAppend;
  Yield: WireFormat.Statements.Yield;
  Debugger: WireFormat.Statements.Debugger;
  Partial: WireFormat.Statements.Partial;
  InElement: WireFormat.Statements.InElement;
  Block: WireFormat.Statements.Block;
  Component: WireFormat.Statements.Component;
  SimpleElement: WireFormat.Statement[];
  ElementModifier: WireFormat.Statements.Modifier;
  SplatAttr: WireFormat.Statements.AttrSplat;
  Interpolate: WireFormat.Expressions.Concat;
  inlineBlock: WireFormat.SerializedInlineBlock;
  positionalArguments: WireFormat.Core.Params;
  namedArguments: WireFormat.Core.Hash;
  args: WireFormat.Core.Args;
  namedBlocks: WireFormat.Core.Blocks;
  componentParams: WireFormat.Core.ElementParameters;
  dynamicElementParams: WireFormat.Statements.Attribute[];
  simpleElementParams: WireFormat.Statements.Attribute[];

  elementAttr: WireFormat.Statements.ElementAttribute;
  elementAttrWithNs: WireFormat.Statements.ElementAttribute;
  elementAttrs: WireFormat.Statements.ElementAttribute[];

  dynamicElementAttr: WireFormat.Statements.ComponentAttribute;
  dynamicElementAttrWithNs: WireFormat.Statements.ComponentAttribute;
  dynamicElementAttrs: WireFormat.Statements.ComponentAttribute[];
}

class PackedContentDecoder implements unpack.UnpackContent<ContentOutput, ExpressionOutput> {
  constructor(private scope: unpack.Scope) {}

  appendComment(value: string): WireFormat.Statements.Comment {
    return [SexpOpcodes.Comment, value];
  }

  yield(to: number, positional: WireFormat.Core.Expression[]): WireFormat.Statements.Yield {
    return [SexpOpcodes.Yield, to, toPresentOption(positional)];
  }

  debugger(info: packed.content.EvalInfo): WireFormat.Statements.Debugger {
    return [SexpOpcodes.Debugger, info];
  }

  partial(
    target: WireFormat.Expression,
    info: packed.content.EvalInfo
  ): WireFormat.Statements.Partial {
    return [SexpOpcodes.Partial, target, info];
  }

  inElement(
    destination: WireFormat.Expression,
    block: WireFormat.SerializedInlineBlock,
    insertBefore: WireFormat.Expression | undefined
  ): WireFormat.Statements.InElement {
    if (insertBefore === undefined) {
      return [SexpOpcodes.InElement, block, guid, destination];
    } else {
      return [SexpOpcodes.InElement, block, guid, destination, insertBefore];
    }
  }

  invokeBlock(
    callee: WireFormat.Expression,
    args: WireFormat.Core.Args,
    blocks: WireFormat.Core.Blocks
  ): WireFormat.Statements.Block {
    return [SexpOpcodes.Block, callee, ...args, blocks];
  }

  simpleElement(
    tag: string,
    attrs: WireFormat.Statements.ElementAttribute[] | null,
    content: WireFormat.Statements.Statement[] | null
  ): WireFormat.Statements.Statement[] {
    return [
      [SexpOpcodes.OpenElement, tag],
      ...(attrs || []),
      [SexpOpcodes.FlushElement],
      ...(content || []),
      [SexpOpcodes.CloseElement],
    ];
  }

  dynamicElement(
    tag: string,
    attrs: (WireFormat.Statements.ComponentAttribute | WireFormat.Statements.AttrSplat)[] | null,
    content: WireFormat.Statements.Statement[] | null
  ): WireFormat.Statements.Statement[] {
    return [
      [SexpOpcodes.OpenElementWithSplat, tag],
      ...(attrs || []),
      [SexpOpcodes.FlushElement],
      ...(content || []),
      [SexpOpcodes.CloseElement],
    ];
  }

  component(
    callee: WireFormat.Expression,
    params: WireFormat.Statements.ElementParameter[] | null,
    named: Option<[PresentArray<string>, PresentArray<WireFormat.Expressions.Expression>]>,
    blocks: Option<[string[], WireFormat.SerializedInlineBlock[]]>
  ): WireFormat.Statements.Component {
    return [
      SexpOpcodes.Component,
      callee,
      params === null ? null : toPresentOption(params),
      named,
      blocks,
    ];
  }

  modifier(
    callee: WireFormat.Expression,
    args: WireFormat.Core.Args
  ): WireFormat.Statements.Modifier {
    return [SexpOpcodes.Modifier, callee, ...args];
  }

  splatAttr(): WireFormat.Statements.AttrSplat {
    return [SexpOpcodes.AttrSplat, this.scope.symbols.indexOf('&attrs')];
  }

  interpolate(exprs: PresentArray<WireFormat.Expression>): WireFormat.Expressions.Concat {
    return [SexpOpcodes.Concat, exprs];
  }

  append(
    value: WireFormat.Expressions.Expression,
    trusting: boolean
  ): WireFormat.Statements.Append | WireFormat.Statements.TrustingAppend {
    if (trusting) {
      return [SexpOpcodes.TrustingAppend, value];
    } else {
      return [SexpOpcodes.Append, value];
    }
  }

  inlineBlock(
    params: number[],
    content: WireFormat.Statements.Statement[]
  ): WireFormat.SerializedInlineBlock {
    return {
      statements: content,
      parameters: params,
    };
  }

  namedBlocks(blocks: [string, WireFormat.SerializedInlineBlock][] | null): WireFormat.Core.Blocks {
    if (blocks === null) {
      return null;
    }

    let names: string[] = [];
    let list: WireFormat.SerializedInlineBlock[] = [];

    for (let [name, block] of blocks) {
      names.push(name);
      list.push(block);
    }

    assertPresent(names);
    assertPresent(list);

    return [names, list];
  }

  elementAttrs(
    attrs: WireFormat.Statements.ElementAttribute[],
    dynamic: false
  ): WireFormat.Statements.ElementAttribute[];
  elementAttrs(
    attrs: WireFormat.Statements.ComponentAttribute[],
    dynamic: true
  ): WireFormat.Statements.ComponentAttribute[];
  elementAttrs(
    attrs: WireFormat.Statements.ElementAttribute[] | WireFormat.Statements.ComponentAttribute[]
  ): WireFormat.Statements.ElementAttribute[] | WireFormat.Statements.ComponentAttribute[] {
    return attrs;
  }

  elementAttr(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    dynamic: true;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute;
  elementAttr(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    dynamic: false;
    trusting: boolean;
  }): WireFormat.Statements.ElementAttribute;
  elementAttr(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    dynamic: boolean;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute | WireFormat.Statements.ElementAttribute;
  elementAttr({
    name,
    value,
    dynamic: hasSplat,
    trusting,
  }: {
    name: string;
    value: WireFormat.Expressions.Expression;
    dynamic: boolean;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute | WireFormat.Statements.ElementAttribute {
    if (hasSplat) {
      if (typeof value === 'string') {
        return [SexpOpcodes.StaticAttr, name, value];
      } else {
        return trusting
          ? [SexpOpcodes.TrustingComponentAttr, name, value]
          : [SexpOpcodes.ComponentAttr, name, value];
      }
    } else {
      if (typeof value === 'string') {
        return [SexpOpcodes.StaticAttr, name, value];
      } else {
        return trusting
          ? [SexpOpcodes.TrustingDynamicAttr, name, value]
          : [SexpOpcodes.DynamicAttr, name, value];
      }
    }
  }

  elementAttrWithNs(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    ns: AttrNamespace;
    dynamic: true;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute;
  elementAttrWithNs(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    ns: AttrNamespace;
    dynamic: false;
    trusting: boolean;
  }): WireFormat.Statements.ElementAttribute;
  elementAttrWithNs(options: {
    name: string;
    value: WireFormat.Expressions.Expression;
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute | WireFormat.Statements.ElementAttribute;
  elementAttrWithNs({
    name,
    value,
    ns,
    dynamic: hasSplat,
    trusting,
  }: {
    name: string;
    value: WireFormat.Expressions.Expression;
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): WireFormat.Statements.ComponentAttribute | WireFormat.Statements.ElementAttribute {
    if (hasSplat) {
      if (typeof value === 'string') {
        return [SexpOpcodes.StaticAttr, name, value, ns];
      } else {
        return trusting
          ? [SexpOpcodes.TrustingComponentAttr, name, value, ns]
          : [SexpOpcodes.ComponentAttr, name, value, ns];
      }
    } else {
      if (typeof value === 'string') {
        return [SexpOpcodes.StaticAttr, name, value, ns];
      } else {
        return trusting
          ? [SexpOpcodes.TrustingDynamicAttr, name, value, ns]
          : [SexpOpcodes.DynamicAttr, name, value, ns];
      }
    }
  }
}

interface ExpressionOutput {
  expr: WireFormat.Expression;
  HasBlock: WireFormat.Expressions.HasBlock;
  HasBlockParams: WireFormat.Expressions.HasBlockParams;
  Literal: WireFormat.Expressions.Value | WireFormat.Expressions.Undefined;
  GetThis: WireFormat.Expressions.GetSymbol;
  GetSymbol: WireFormat.Expressions.GetSymbol;
  GetNamespacedFree: WireFormat.Expressions.GetContextualFree;
  GetStrictFree: WireFormat.Expressions.GetStrictFree;
  GetLooseAttr: WireFormat.Expressions.GetContextualFree;
  GetLooseAppend: WireFormat.Expressions.GetContextualFree;
  GetPath: WireFormat.Expressions.GetPath;
  Invoke: WireFormat.Expressions.InvokeHelper;
  positionalArguments: WireFormat.Core.Params;
  namedArguments: WireFormat.Core.Hash;
  args: WireFormat.Core.Args;
}

class PackedExpressionDecoder implements unpack.UnpackExpr<ExpressionOutput> {
  constructor(private scope: unpack.Scope) {}

  hasBlock(symbol: number | undefined): WireFormat.Expressions.HasBlock {
    return [
      Op.HasBlock,
      [Op.GetSymbol, symbol === undefined ? this.scope.symbols.indexOf('&default') : symbol],
    ];
  }

  hasBlockParams(symbol: number | undefined): WireFormat.Expressions.HasBlockParams {
    return [
      Op.HasBlockParams,
      [Op.GetSymbol, symbol === undefined ? this.scope.symbols.indexOf('&default') : symbol],
    ];
  }

  literal(
    value: string | number | boolean | null | undefined
  ): string | number | boolean | WireFormat.Expressions.Undefined | null {
    if (value === undefined) {
      return [Op.Undefined];
    } else {
      return value;
    }
  }

  getThis(): WireFormat.Expressions.GetSymbol {
    return [Op.GetSymbol, 0];
  }

  getSymbol(value: number): WireFormat.Expressions.GetSymbol {
    return [Op.GetSymbol, value];
  }

  getNamespacedFree(
    upvar: number,
    namespace: packed.expr.VariableNamespace
  ): WireFormat.Expressions.GetContextualFree {
    switch (namespace) {
      case packed.expr.VariableNamespace.Component:
        return [Op.GetFreeAsComponentHead, upvar];
      case packed.expr.VariableNamespace.Helper:
        return [Op.GetFreeAsHelperHead, upvar];
      case packed.expr.VariableNamespace.Modifier:
        return [Op.GetFreeAsModifierHead, upvar];
      case packed.expr.VariableNamespace.HelperOrComponent:
        return [Op.GetFreeAsComponentOrHelperHead, upvar];
    }
  }
  getStrictFree(upvar: number): WireFormat.Expressions.GetStrictFree {
    return [Op.GetStrictFree, upvar];
  }

  getLooseAttr(upvar: number): WireFormat.Expressions.GetContextualFree {
    return [Op.GetFreeAsHelperHeadOrThisFallback, upvar];
  }

  getLooseAppend(upvar: number): WireFormat.Expressions.GetContextualFree {
    return [Op.GetFreeAsComponentOrHelperHeadOrThisFallback, upvar];
  }

  getPath(
    head: WireFormat.Expressions.Expression,
    tail: PresentArray<string>
  ): WireFormat.Expressions.GetPath {
    return [Op.GetPath, head, tail];
  }

  invoke(
    callee: WireFormat.Expressions.Expression,
    args: WireFormat.Core.Args
  ): WireFormat.Expressions.InvokeHelper {
    return [Op.InvokeHelper, callee, ...args];
  }

  positional(
    positional: PresentArray<WireFormat.Expressions.Expression> | null
  ): WireFormat.Core.Params {
    return positional;
  }

  namedArguments(
    named: [string, WireFormat.Expressions.Expression][] | null
  ): WireFormat.Core.Hash {
    if (named === null) {
      return null;
    }

    let names: string[] = [];
    let values: Expr.Expression[] = [];

    for (let [key, value] of named) {
      names.push(key);
      values.push(value);
    }

    assertPresent(names);
    assertPresent(values);

    return [names, values];
  }

  args(positional: WireFormat.Core.Params, named: WireFormat.Core.Hash): WireFormat.Core.Args {
    return [positional, named];
  }
}
