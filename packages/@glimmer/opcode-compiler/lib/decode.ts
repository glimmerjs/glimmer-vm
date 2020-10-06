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
import Core = WireFormat.Core;

export function decode(raw: string, encoder: 'default' | 'packed'): SerializedTemplateBlock {
  if (encoder === 'default') {
    return JSON.parse(raw);
  } else {
  }

  let packedTemplate = JSON.parse(raw) as unpack.Template;

  let decoder: unpack.Decoder<ExpressionOutput, ContentOutput> = new unpack.Decoder(
    new ContentUnpacker(packedTemplate),
    new ExpressionUnpacker(packedTemplate),
    packedTemplate
  );

  let out = WireStatements.toArray(decoder.decode());

  return {
    symbols: packedTemplate.symbols,
    upvars: packedTemplate.upvars,
    hasEval: packedTemplate.hasEval,
    statements: out,
  };
}

export declare class ExpressionOutput extends unpack.ExprOutput {
  expr: Expr.Expression;
  HasBlock: Expr.HasBlock;
  HasBlockParams: Expr.HasBlockParams;
  Literal: Expr.Value | Expr.Undefined;
  GetThis: Expr.GetSymbol;
  GetSymbol: Expr.GetSymbol;
  GetNamespacedFree: Expr.GetContextualFree;
  GetStrictFree: Expr.GetStrictFree;
  GetLooseAttr: Expr.GetContextualFree;
  GetLooseAppend: Expr.GetContextualFree;
  GetPath: Expr.GetPath;
  Invoke: Expr.InvokeHelper;
  positionalArguments: Core.Params;
  namedArguments: Core.Hash;
  args: Core.Args;
}

type Content = WireFormat.Statement | WireStatements;

class WireStatements {
  static toArray(content: Content[]): WireFormat.Statement[] {
    let stmts = new WireStatements();

    for (let item of content) {
      stmts.add(item);
    }

    return stmts.toArray();
  }

  constructor(private list: WireFormat.Statement[] = []) {}

  addList(items: Content[] | null) {
    if (items === null) {
      return;
    }

    for (let item of items) {
      this.add(item);
    }
  }

  add(item: Content | null) {
    if (item === null) {
      return;
    }

    if (item instanceof WireStatements) {
      this.list.push(...item.toArray());
    } else {
      this.list.push(item);
    }
  }

  toArray(): WireFormat.Statement[] {
    return this.list;
  }
}
export declare class ContentOutput extends unpack.ContentOutput {
  Append: Stmt.Append | Stmt.TrustingAppend;
  Comment: Stmt.Comment;
  Yield: Stmt.Yield;
  Debugger: Stmt.Debugger;
  Partial: Stmt.Partial;
  InElement: Stmt.InElement;
  InvokeBlock: Stmt.Block;
  Component: Stmt.Component;
  SimpleElement: WireStatements;
  DynamicElement: WireStatements;
  ElementModifier: Stmt.Modifier;
  SplatAttr: Stmt.AttrSplat;
  Interpolate: Expr.Concat;
  inlineBlock: WireFormat.SerializedInlineBlock;
  positionalArguments: Core.Params;
  namedArguments: Core.Hash;
  args: Core.Args;
  namedBlocks: Core.Blocks;
  componentParams: Stmt.ComponentAttribute[];
  dynamicElementParams: Stmt.ComponentAttribute[];
  simpleElementParams: Stmt.ElementAttribute[];

  elementAttr: Stmt.ElementAttribute;
  elementAttrWithNs: Stmt.ElementAttribute;
  elementAttrs: Stmt.ElementAttribute[];

  dynamicElementAttr: Stmt.ComponentAttribute;
  dynamicElementAttrWithNs: Stmt.ComponentAttribute;
  dynamicElementAttrs: Stmt.ComponentAttribute[];
}

class ContentUnpacker extends unpack.UnpackContent<ContentOutput, ExpressionOutput> {
  constructor(private scope: unpack.Scope) {
    super();
  }

  appendComment(value: string): WireFormat.Statements.Comment {
    return [SexpOpcodes.Comment, value];
  }

  yield(
    to: number | undefined,
    positional: WireFormat.Core.Expression[]
  ): WireFormat.Statements.Yield {
    return [
      SexpOpcodes.Yield,
      to === undefined ? this.scope.symbols.indexOf('&default') + 1 : to,
      toPresentOption(positional),
    ];
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
    insertBefore: WireFormat.Expression | undefined,
    guid: string
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
    content: Content[] | null
  ): WireStatements {
    let stmts = new WireStatements();

    stmts.add([SexpOpcodes.OpenElement, tag]);
    stmts.addList(attrs);
    stmts.add([SexpOpcodes.FlushElement]);
    stmts.addList(content);
    stmts.add([SexpOpcodes.CloseElement]);

    return stmts;
  }

  dynamicElement(
    tag: string,
    attrs: (WireFormat.Statements.ComponentAttribute | WireFormat.Statements.AttrSplat)[] | null,
    content: Content[] | null
  ): WireStatements {
    let stmts = new WireStatements();

    stmts.add([SexpOpcodes.OpenElementWithSplat, tag]);
    stmts.addList(attrs);
    stmts.add([SexpOpcodes.FlushElement]);
    stmts.addList(content);
    stmts.add([SexpOpcodes.CloseElement]);

    return stmts;
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
    return [SexpOpcodes.AttrSplat, this.scope.symbols.indexOf('&attrs') + 1];
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

  inlineBlock(params: number[], content: Content[]): WireFormat.SerializedInlineBlock {
    return {
      statements: WireStatements.toArray(content),
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
        return [SexpOpcodes.StaticComponentAttr, name, value];
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

class ExpressionUnpacker extends unpack.UnpackExpr<ExpressionOutput> {
  constructor(private scope: unpack.Scope) {
    super();
  }

  hasBlock(symbol: number | undefined): WireFormat.Expressions.HasBlock {
    return [
      Op.HasBlock,
      [Op.GetSymbol, symbol === undefined ? this.scope.symbols.indexOf('&default') + 1 : symbol],
    ];
  }

  hasBlockParams(symbol: number | undefined): WireFormat.Expressions.HasBlockParams {
    return [
      Op.HasBlockParams,
      [Op.GetSymbol, symbol === undefined ? this.scope.symbols.indexOf('&default') + 1 : symbol],
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
