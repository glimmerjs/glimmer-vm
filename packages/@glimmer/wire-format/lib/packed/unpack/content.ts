import { assert, assertNever, unreachable } from '@glimmer/util';
import { AttrNamespace } from '@simple-dom/interface';
import {
  AppendWhat,
  AttrOptions,
  AttrSplat,
  AttrValue,
  Content,
  ContentOp,
  ElementAttr,
  ElementModifier,
  ElementParameter,
  hasParams,
  inflateAttrName,
  InlineBlock,
  isInterpolate,
  isModifier,
  NamedBlocks,
  nsFor,
} from '../content';
import {
  Expression,
  ExprOp,
  InvokeN,
  LiteralValue,
  LonghandExpression,
  NamedArguments,
  Null,
  PositionalArguments,
  SpecialExpr,
  UnambiguousExpression,
  VariableNamespace,
} from '../expr';
import { PackedList } from '../shared';

interface Scope {
  symbols: string[];
  upvars: string[];
}

type InvokeComponentDebug =
  | readonly ['<>', ExpressionDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, NamedArgumentsDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, ElementParametersDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, NamedArgumentsDebug, ElementParametersDebug, NamedBlocksDebug];

type ContentDebug =
  | ExpressionDebug
  | string
  | '%debugger'
  | readonly ['%partial', ExpressionDebug]
  | '%yield'
  | readonly ['%yield', ...ExpressionDebug[]]
  | readonly ['%yield', { to: string }, ...ExpressionDebug[]]
  | readonly ['html', ExpressionDebug]
  | readonly ['text', ExpressionDebug]
  | readonly ['{{#}}', ExpressionDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, PositionalDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, NamedArgumentsDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, PositionalDebug, NamedArgumentsDebug, NamedBlocksDebug]
  | readonly [string /* `<...>` */, AttrsDebug]
  | readonly [string /* `<...>` */, AttrsDebug, ...ContentDebug[]]
  | readonly [string /* `<...>` */, ...ContentDebug[]]
  | readonly [string /* `<...>` */]
  | readonly [
      op: '%in-element',
      destination: ExpressionDebug,
      block: InlineBlockDebug,
      insertBefore?: ExpressionDebug
    ]
  | InvokeComponentDebug;

export function content(c: Content, scope: Scope): ContentDebug {
  if (c === ContentOp.Yield) {
    return '%yield';
  }

  switch (c[0]) {
    case ContentOp.Append: {
      let [, value, what] = c;

      if (what === undefined && typeof value === 'string') {
        switch (value[0]) {
          case '!':
            return `comment|${value.slice(1)}`;
          case '#':
            return `html|${value.slice(1)}`;
          default:
            return `text|${value}`;
        }
      }

      switch (c[2]) {
        case AppendWhat.Comment:
          assert(typeof c[1] === 'string', `dynamic contents are not allowed`);
          return `comment|${c[1]}`;
        case AppendWhat.Html: {
          if (typeof c[1] === 'string') {
            return `html|${c[1]}`;
          } else {
            return ['html', expr(c[1], scope)];
          }
        }
        case AppendWhat.Text:
          if (typeof c[1] === 'string') {
            return `text|${c[1]}`;
          } else {
            return ['text', expr(c[1], scope)];
          }
        case undefined:
          return ['text', expr(c[1], scope)];
      }
    }

    case ContentOp.InvokeBlock: {
      let [, callee, blocks, p, n] = c;

      return ['{{#}}', expr(callee, scope), ...args(p, n, scope), namedBlocks(blocks, scope)];
    }

    case ContentOp.InvokeComponent: {
      let [, callee, blocks, p, a] = c;

      let head = ['<>', expr(callee, scope)] as const;

      let args = namedArguments(a, scope);
      let argsPart = args ? ([args] as const) : ([] as const);

      let params = elementParameters(p, scope);
      let paramsPart = params ? ([params] as const) : ([] as const);

      let blocksPart = namedBlocks(blocks, scope);

      return [...head, ...argsPart, ...paramsPart, blocksPart];
    }

    case ContentOp.SplatElement:
    case ContentOp.SimpleElement: {
      let [, tag, packedAttrs, packedBody] = c;

      let attrsDebug = attrs(packedAttrs, scope);
      let bodyDebug =
        packedBody === undefined || packedBody === Null
          ? null
          : packedBody.map((p) => content(p, scope));

      let tail = combineSpread(attrsDebug, bodyDebug);
      return [`<${tag}>`, ...tail];
    }

    case ContentOp.Yield: {
      if (c.length > 2) {
        let [, to, ...exprs]: [unknown, to: number, ...exprs: Expression[]] = c;
        return ['%yield', { to: scope.symbols[to] }, ...exprs.map((e) => expr(e, scope))];
      } else {
        return ['%yield', { to: scope.symbols[c[1]] }];
      }
    }

    case ContentOp.Debugger: {
      return '%debugger';
    }

    case ContentOp.Partial:
      return ['%partial', expr(c[1], scope)];

    case ContentOp.InElement: {
      let [, destination, b, insertBefore] = c;
      let head = ['%in-element', expr(destination, scope), block(b, scope)] as const;

      if (insertBefore !== undefined) {
        return [...head, expr(insertBefore, scope)] as const;
      } else {
        return head;
      }
    }
  }
}

type ExpressionDebug =
  | UnambiguousExpressionDebug
  | null
  | undefined
  | boolean
  | string
  | number
  | '%has-block'
  | '%has-block-params'
  | ['%has-block', ExpressionDebug]
  | ['%has-block-params', ExpressionDebug];

function isLonghand(e: Expression): e is LonghandExpression {
  return (
    e !== ExprOp.GetThis &&
    e !== SpecialExpr.HasBlock &&
    e !== SpecialExpr.HasBlockParams &&
    typeof e !== 'string'
  );
}

export function expr(e: Expression, scope: Scope): ExpressionDebug {
  if (isLonghand(e)) {
    return longhand(e, scope);
  }

  // shorthand HasBlock
  if (e === SpecialExpr.HasBlock) {
    return '%has-block';
  }

  // shorthand HasBlockParams
  if (e === SpecialExpr.HasBlockParams) {
    return '%has-block-params';
  }

  if (typeof e === 'number') {
    switch (e) {
      case LiteralValue.Null:
        return null;
      case LiteralValue.Undefined:
        return undefined;
      case LiteralValue.True:
        return true;
      case LiteralValue.False:
        return false;
      default:
        throw unreachable('packed numbers are always literals');
    }
  }

  if (typeof e === 'string') {
    switch (e[0]) {
      case ':':
        // shorthand string
        return e.slice(1);
      case '|':
        // shorthand number
        return parseFloat(e.slice(1));
      default:
        throw unreachable('should have handled all string expressions');
    }
  }

  assertNever(e);
}

export function longhand(e: LonghandExpression, scope: Scope): ExpressionDebug {
  switch (e[0]) {
    case ExprOp.GetThis:
      return 'this';
    case SpecialExpr.HasBlock:
      return e.length === 1 ? '%has-block' : ['%has-block', expr(e[1], scope)];
    case SpecialExpr.HasBlockParams:
      return e.length === 1 ? '%has-block-params' : ['%has-block-params', expr(e[1], scope)];
    case SpecialExpr.Literal:
      if (typeof e[1] === 'string') {
        return e[1];
      } else {
        switch (e[1]) {
          case LiteralValue.Null:
            return null;
          case LiteralValue.Undefined:
            return undefined;
          case LiteralValue.True:
            return true;
          case LiteralValue.False:
            return false;
          default:
            return e[1] - LiteralValue.Offset;
        }
      }

    default:
      return unambiguousExpression(e, scope);
  }
}

type CallDebug =
  | ['()', ExpressionDebug]
  | ['()', ExpressionDebug, PositionalDebug]
  | ['()', ExpressionDebug, NamedArgumentsDebug]
  | ['()', ExpressionDebug, PositionalDebug, NamedArgumentsDebug];

type UnambiguousExpressionDebug = string | ['.', ExpressionDebug, string] | CallDebug;

export function unambiguousExpression(
  e: UnambiguousExpression,
  scope: Scope
): UnambiguousExpressionDebug {
  switch (e[0]) {
    case ExprOp.GetSymbol:
      return scope.symbols[e[1]];
    case ExprOp.GetNamespacedFree:
      if (e.length === 3) {
        return `${varNamespace(e[2])}::${scope.upvars[e[1]]}`;
      } else {
        return `!${scope.upvars[e[1]]}`;
      }
    case ExprOp.GetLooseHelper:
      return `attr?::${scope.upvars[e[1]]}`;
    case ExprOp.GetLooseHelperOrComponent:
      return `append?::${scope.upvars[e[1]]}`;

    case ExprOp.GetPath: {
      if (e.length > 3) {
        return ['.', expr(e[1], scope), e[2]];
      } else {
        return ['.', expr(e[1], scope), e.slice(2).join('.')];
      }
    }

    case ExprOp.Invoke: {
      return invoke(e, scope);
    }

    case ExprOp.InvokeNamed: {
      return ['()', expr(e[1], scope), ...args(undefined, e[2], scope)];
    }
  }
}

function invoke(e: InvokeN | ElementModifier, scope: Scope): CallDebug {
  return ['()', expr(e[1], scope), ...args(e[2], e[3], scope)];
}

type ArgsDebug =
  | []
  | [PositionalDebug]
  | [NamedArgumentsDebug]
  | [PositionalDebug, NamedArgumentsDebug];

function args(
  p: PositionalArguments | undefined,
  n: NamedArguments | undefined,
  scope: Scope
): ArgsDebug {
  return combine(positional(p, scope), namedArguments(n, scope));
}

type PositionalDebug = ExpressionDebug[] | null;

function positional(p: PositionalArguments | undefined, scope: Scope): PositionalDebug {
  if (p === Null || p === undefined) {
    return null;
  } else {
    return p.map((p) => expr(p, scope));
  }
}

type NamedArgumentsDebug = Record<string, ExpressionDebug>;

function namedArguments(p: NamedArguments | undefined, scope: Scope): NamedArgumentsDebug | null {
  if (p === Null || p === undefined) {
    return null;
  }

  let o: Record<string, ExpressionDebug> = {};
  let names = p[0].split('|');

  names.forEach((n, i) => (o[n] = expr(p[i + 1], scope)));

  return o;
}

type InlineBlockDebug = [['as', ...string[]], ...ContentDebug[]] | [...ContentDebug[]];

function block(p: InlineBlock, scope: Scope): InlineBlockDebug {
  if (p === Null) {
    return [];
  } else {
    if (hasParams(p)) {
      let [first, ...rest] = p;
      let [, ...symbols] = first;

      return [
        ['as', ...symbols.map((s) => scope.upvars[s])],
        ...(rest as Content[]).map((r) => content(r, scope)),
      ];
    } else {
      return p.map((r) => content(r, scope));
    }
  }
}

type NamedBlocksDebug = Record<string, InlineBlockDebug>;

function namedBlocks(p: NamedBlocks, scope: Scope): NamedBlocksDebug {
  let o: Record<string, InlineBlockDebug> = {};

  let [joinedNames, ...blocks] = p;
  let names = joinedNames.split('|');

  names.forEach((n, i) => (o[n] = block(blocks[i + 1], scope)));

  return o;
}

export function varNamespace(ns: VariableNamespace): string {
  switch (ns) {
    case VariableNamespace.Component:
      return 'component';
    case VariableNamespace.Helper:
      return 'helper';
    case VariableNamespace.Modifier:
      return 'modifier';
    case VariableNamespace.HelperOrComponent:
      return 'append';
  }
}

type AttrsDebug = Record<string, AttrValueDebug> | null;

export function attrs(
  attrs: PackedList<ElementAttr | AttrSplat> | undefined,
  scope: Scope
): AttrsDebug {
  if (attrs === Null || attrs === undefined) {
    return null;
  }

  let out: Record<string, AttrValueDebug> = {};

  for (let attr of attrs) {
    if (attr === AttrSplat) {
      out['...attributes'] = '...attributes';
    } else {
      let [name, value, namespace] = attr;
      let val = attrValue(value, namespace, scope);
      out[name] = val;
    }
  }

  return out;
}

type AttrValueDebugWithoutNs = ['+', ...ExpressionDebug[]] | ExpressionDebug;
type AttrValueDebug =
  | '...attributes'
  | AttrValueDebugWithoutNs
  | { value: AttrValueDebugWithoutNs; ns: AttrNamespace };

function attrValueWithoutNs(value: AttrValue, scope: Scope): AttrValueDebugWithoutNs {
  if (isInterpolate(value)) {
    let [, ...parts] = value;
    return ['+', ...parts.map((p) => expr(p, scope))];
  } else {
    return expr(value, scope);
  }
}

function attrValue(
  value: AttrValue,
  options: AttrOptions | undefined,
  scope: Scope
): AttrValueDebug {
  let val = attrValueWithoutNs(value, scope);
  let ns = options === undefined ? null : nsFor(options);

  if (isInterpolate(value)) {
    let [, ...parts] = value;
    val = ['+', ...parts.map((p) => expr(p, scope))];
  } else {
    val = expr(value, scope);
  }

  if (ns !== null) {
    return { value: val, ns };
  } else {
    return val;
  }
}

type ElementAttrDebug = readonly [name: string, value: AttrValueDebugWithoutNs, ns?: AttrNamespace];

type ElementParametersDebug = ElementParameterDebug[];
type ElementParameterDebug = ElementAttrDebug | CallDebug | '...attributes';

function attr([name, value, namespace]: ElementAttr, scope: Scope): ElementAttrDebug {
  let out = [inflateAttrName(name), attrValueWithoutNs(value, scope)] as const;
  let ns = nsFor(namespace);

  return ns ? [...out, ns] : out;
}

function elementParameters(
  params: PackedList<ElementParameter> | undefined,
  scope: Scope
): ElementParametersDebug | null {
  if (params === Null || params === undefined) {
    return null;
  }

  return params.map((p) => parameter(p, scope));
}

function parameter(p: ElementParameter, scope: Scope): ElementParameterDebug {
  if (p === AttrSplat) {
    return '...attributes';
  } else if (isModifier(p)) {
    return invoke(p, scope);
  } else {
    return attr(p, scope);
  }
}

function isPresent<T>(value: T | null | undefined | Null): value is T {
  return value !== null && value !== undefined && value !== Null;
}

function combine<T, U>(
  left: T | null | undefined | Null,
  right: U | null | undefined | Null
): [] | [T] | [U] | [T, U] {
  if (isPresent(left)) {
    return isPresent(right) ? [left, right] : [left];
  } else {
    return isPresent(right) ? [right] : [];
  }
}

function combineSpread<T, U>(
  left: T | null | undefined,
  right: U[] | null | undefined
): [] | [T] | [...U[]] | [T, ...U[]] {
  if (left === null || left === undefined) {
    return right === null || right === undefined ? [] : right;
  } else {
    return right === null || right === undefined ? [left] : [left, ...right];
  }
}
