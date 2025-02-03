import type {
  AttrOpcode,
  ComponentAttrOpcode,
  DynamicAttrOpcode,
  Nullable,
  Optional,
  SerializedInlineBlock,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  WellKnownAttrName,
  WireFormat,
} from '@glimmer/interfaces';
import type { BlockSymbolTable } from '@glimmer/syntax';
import { assertPresentArray, exhausted, localAssert } from '@glimmer/debug-util';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { isGetLexical, isGetVar, SexpOpcodes as Op } from '@glimmer/wire-format';

import type { OptionalList } from '../../shared/list';
import type * as mir from './mir';

import {
  blockType,
  buildAppend,
  buildComponentArgs,
  compact,
  headType,
  isGet,
  isGetSymbol,
  isTupleExpression,
  MODIFIER_TYPES,
  needsAtNames,
} from '../../builder/builder';
import { deflateAttrName, deflateTagName } from '../../utils';
import { EXPR } from './expressions';

class WireStatements<S extends WireFormat.Statement = WireFormat.Statement> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

export class ContentEncoder {
  list(statements: mir.Statement[]): WireFormat.Statement[] {
    let out: WireFormat.Statement[] = [];

    for (let statement of statements) {
      let result = CONTENT.content(statement);

      if (result instanceof WireStatements) {
        out.push(...result.toArray());
      } else {
        out.push(result);
      }
    }

    return out;
  }

  content(stmt: mir.Statement): WireFormat.Statement | WireStatements {
    if (LOCAL_TRACE_LOGGING) {
      LOCAL_LOGGER.debug(`encoding`, stmt);
    }

    return this.visitContent(stmt);
  }

  private visitContent(stmt: mir.Statement): WireFormat.Statement | WireStatements {
    switch (stmt.type) {
      case 'Debugger':
        return [Op.Debugger, ...stmt.scope.getDebugInfo(), {}];
      case 'AppendComment':
        return this.AppendComment(stmt);
      case 'AppendValue':
        return this.AppendValue(stmt);
      case 'AppendTrustedHTML':
        return this.AppendTrustedHTML(stmt);
      case 'Yield':
        return this.Yield(stmt);
      case 'Component':
        return this.Component(stmt);
      case 'SimpleElement':
        return this.SimpleElement(stmt);
      case 'InElement':
        return this.InElement(stmt);
      case 'InvokeBlock':
        return this.InvokeBlock(stmt);
      case 'If':
        return this.If(stmt);
      case 'Each':
        return this.Each(stmt);
      case 'Let':
        return this.Let(stmt);
      case 'WithDynamicVars':
        return this.WithDynamicVars(stmt);
      case 'InvokeComponent':
        return this.InvokeComponent(stmt);
      default:
        return exhausted(stmt);
    }
  }

  Yield({ to, positional }: mir.Yield): WireFormat.Statements.Yield {
    return [Op.Yield, to, EXPR.Positional(positional)];
  }

  InElement({
    guid,
    insertBefore,
    destination,
    block,
  }: mir.InElement): WireFormat.Statements.InElement {
    let wireBlock = CONTENT.NamedBlock(block)[1];
    // let guid = args.guid;
    let wireDestination = EXPR.expr(destination);
    let wireInsertBefore = EXPR.expr(insertBefore);

    if (wireInsertBefore === undefined) {
      return [Op.InElement, wireBlock, guid, wireDestination];
    } else {
      return [Op.InElement, wireBlock, guid, wireDestination, wireInsertBefore];
    }
  }

  BlockArgs(
    argsNode: Pick<mir.Args, 'positional' | 'named'>,
    blocksNode: Nullable<mir.NamedBlocks>,
    { insertAtPrefix }: { insertAtPrefix: boolean }
  ): Optional<WireFormat.Core.BlockArgs> {
    return compact({
      ...EXPR.Args(argsNode, insertAtPrefix),
      blocks: blocksNode ? this.NamedBlocks(blocksNode) : undefined,
    });
  }

  InvokeBlock({ head, args, blocks }: mir.InvokeBlock): WireFormat.Statements.SomeBlock {
    const path = EXPR.expr(head);

    localAssert(isGet(path), `Expected ${JSON.stringify(path)} to be a Get`);

    return [
      ...blockType(path),
      this.BlockArgs(args, blocks, { insertAtPrefix: needsAtNames(path) }),
    ];
  }

  AppendTrustedHTML({ html }: mir.AppendTrustedHTML): WireFormat.Statements.TrustingAppend {
    return [Op.TrustingAppend, EXPR.expr(html)];
  }

  AppendValue({ value }: mir.AppendValue): WireFormat.Statements.SomeAppend {
    return buildAppend(false, EXPR.expr(value));
  }

  AppendComment({ value }: mir.AppendComment): WireFormat.Statements.Comment {
    return [Op.Comment, value.chars];
  }

  SimpleElement({ tag, params, body, dynamicFeatures }: mir.SimpleElement): WireStatements {
    let op = dynamicFeatures ? Op.OpenElementWithSplat : Op.OpenElement;
    return new WireStatements<WireFormat.Statement | WireFormat.ElementParameter>([
      [op, deflateTagName(tag.chars)],
      ...CONTENT.ElementParameters(params).toArray(),
      [Op.FlushElement],
      ...CONTENT.list(body),
      [Op.CloseElement],
    ]);
  }

  // This is used by the `{{component}}` keyword
  Component({
    tag,
    params,
    args: named,
    blocks,
  }: mir.Component):
    | WireFormat.Statements.InvokeLexicalComponent
    | WireFormat.Statements.ResolvedComponent
    | WireFormat.Statements.DynamicComponent {
    let wireTag = EXPR.expr(tag);
    let wirePositional = CONTENT.ElementParameters(params);
    let wireNamed = EXPR.NamedArguments(named, false);

    let wireNamedBlocks = CONTENT.NamedBlocks(blocks);

    const args = buildComponentArgs(wirePositional.toPresentArray(), wireNamed, wireNamedBlocks);

    localAssert(
      isTupleExpression(wireTag),
      `Expected ${JSON.stringify(wireTag)} to be a tuple expression`
    );

    // There are special cases for non-path expressions that refer to out-of-template variables:
    // lexical variables and resolved variables.

    if (isGetLexical(wireTag)) {
      // if the expression is something like `x.Foo`, then the component is dynamic, not
      // a lexical variable.
      return [
        wireTag.length === 2 ? Op.InvokeLexicalComponent : Op.DynamicComponent,
        wireTag,
        args,
      ];
    }

    if (wireTag[0] === Op.GetFreeAsComponentHead) {
      localAssert(
        wireTag.length === 2,
        `Unexpected free variable as component head with a path tail ${JSON.stringify(wireTag)}`
      );

      return [Op.ResolvedComponent, wireTag, args];
    }

    // The only remaining case here should be a reference to a local Handlebars variable (possibly a
    // path).
    localAssert(isGetSymbol(wireTag), `Expected ${JSON.stringify(wireTag)} to be a symbol`);

    return [Op.DynamicComponent, wireTag, args];
  }

  ElementParameters({ body }: mir.ElementParameters): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.ElementParameter(p));
  }

  ElementParameter(param: mir.ElementParameter): WireFormat.ElementParameter {
    switch (param.type) {
      case 'SplatAttr':
        return [Op.AttrSplat, param.symbol];
      case 'DynamicAttr':
        return [dynamicAttrOp(param.kind), ...dynamicAttr(param)];
      case 'StaticAttr':
        return [staticAttrOp(param.kind), ...staticAttr(param)];
      case 'Modifier': {
        const expr = EXPR.expr(param.callee);
        return [MODIFIER_TYPES[headType(expr)], EXPR.expr(param.callee), EXPR.Args(param.args)];
      }
    }
  }

  NamedBlocks({ blocks: blocksNode }: mir.NamedBlocks): Optional<WireFormat.Core.Blocks> {
    const blocks = blocksNode.toPresentArray();
    if (!blocks) return;

    let names: string[] = [];
    let serializedBlocks: WireFormat.SerializedInlineBlock[] = [];

    for (const block of blocks) {
      const [name, serializedBlock] = this.NamedBlock(block);

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    assertPresentArray(names);
    assertPresentArray(serializedBlocks);

    return [names, serializedBlocks];
  }

  NamedBlock({ name, body, scope }: mir.NamedBlock): WireFormat.Core.NamedBlock {
    return [name.chars === 'inverse' ? 'else' : name.chars, this.namedBlock(body, scope)];
  }

  namedBlock(body: mir.Statement[], scope: BlockSymbolTable): SerializedInlineBlock {
    return [CONTENT.list(body), scope.slots];
  }

  If({ condition, block, inverse }: mir.If): WireFormat.Statements.If {
    return [
      Op.If,
      EXPR.expr(condition),
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Each({ value, key, block, inverse }: mir.Each): WireFormat.Statements.Each {
    return [
      Op.Each,
      EXPR.expr(value),
      key ? EXPR.expr(key) : null,
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Let({ positional, block }: mir.Let): WireFormat.Statements.Let {
    return [Op.Let, EXPR.Positional(positional), CONTENT.NamedBlock(block)[1]];
  }

  WithDynamicVars({ named, block }: mir.WithDynamicVars): WireFormat.Statements.WithDynamicVars {
    return [
      Op.WithDynamicVars,
      EXPR.NamedArguments(named, false),
      CONTENT.namedBlock(block.body, block.scope),
    ];
  }

  InvokeComponent({
    definition,
    args,
    blocks,
  }: mir.InvokeComponent): WireFormat.Statements.SomeInvokeComponent {
    const expr = EXPR.expr(definition);

    if (typeof expr === 'string' || headType(expr) === 'lexical') {
      return [
        Op.InvokeDynamicComponent,
        expr,
        this.BlockArgs(args, blocks, { insertAtPrefix: false }),
      ];
    } else {
      localAssert(
        Array.isArray(expr) && isGetVar(expr),
        `Expected ${JSON.stringify(expr)} to be an array`
      );

      return [
        Op.InvokeResolvedComponent,
        expr,
        this.BlockArgs(args, blocks, { insertAtPrefix: true }),
      ];
    }
  }
}

export const CONTENT = new ContentEncoder();

export type StaticAttrArgs = [name: string | WellKnownAttrName, value: string, namespace?: string];

function staticAttr({ name, value, namespace }: mir.StaticAttr): StaticAttrArgs {
  let out: StaticAttrArgs = [deflateAttrName(name.chars), value.chars];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

export type DynamicAttrArgs = [
  name: string | WellKnownAttrName,
  value: WireFormat.Expression,
  namespace?: string,
];

function dynamicAttr({ name, value, namespace }: mir.DynamicAttr): DynamicAttrArgs {
  let out: DynamicAttrArgs = [deflateAttrName(name.chars), EXPR.expr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

function staticAttrOp(kind: { component: boolean }): StaticAttrOpcode | StaticComponentAttrOpcode;
function staticAttrOp(kind: { component: boolean }): AttrOpcode {
  if (kind.component) {
    return Op.StaticComponentAttr;
  } else {
    return Op.StaticAttr;
  }
}

function dynamicAttrOp(
  kind: mir.AttrKind
):
  | TrustingComponentAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | DynamicAttrOpcode {
  if (kind.component) {
    return kind.trusting ? Op.TrustingComponentAttr : Op.ComponentAttr;
  } else {
    return kind.trusting ? Op.TrustingDynamicAttr : Op.DynamicAttr;
  }
}
