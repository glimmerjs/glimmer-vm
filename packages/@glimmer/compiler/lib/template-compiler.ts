import TemplateVisitor, { Action } from './template-visitor';
import JavaScriptCompiler, { Template } from './javascript-compiler';
import { assert, Option } from '@glimmer/util';
import { isLiteral, SyntaxError, AST } from '@glimmer/syntax';
import { getAttrNamespace } from './utils';
import { SymbolAllocator, InOp as SymbolInOp, OutOp as SymbolOutOp } from './allocate-symbols';
import { PathHead } from './compiler-ops';
import { DEBUG } from '@glimmer/local-debug-flags';

export interface CompileOptions {
  meta: unknown;
  source: string;
  strict?: boolean;
  customizeComponentName?(tag: string): string;
}

function isTrustedValue(value: any) {
  return value.escaped !== undefined && !value.escaped;
}

export const THIS = 0;

export default class TemplateCompiler {
  static compile(ast: AST.Template, options: CompileOptions): Template {
    let templateVisitor = new TemplateVisitor();
    templateVisitor.visit(ast);

    let compiler = new TemplateCompiler(options);
    let opcodes: SymbolInOp[] = compiler.process(templateVisitor.actions);
    let symbols: SymbolOutOp[] = new SymbolAllocator(opcodes, false).process();

    let out = JavaScriptCompiler.process(symbols, ast.symbols!, options);

    if (DEBUG) {
      console.log(`Template ->`, out);
    }

    return out;
  }

  private templateId = 0;
  private templateIds: number[] = [];
  private opcodes: SymbolInOp[] = [];
  private includeMeta = false;
  private source: string;

  constructor(private options: CompileOptions) {
    this.source = options.source;
  }

  process(actions: Action[]): SymbolInOp[] {
    console.log(actions);
    actions.forEach(([name, ...args]) => {
      if (!this[name]) {
        throw new Error(`Unimplemented ${name} on TemplateCompiler`);
      }
      (this[name] as any)(...args);
    });
    return this.opcodes;
  }

  startProgram([program]: [AST.Template]) {
    this.opcode(['startProgram', program], program);
  }

  endProgram() {
    this.opcode(['endProgram', null], null);
  }

  startBlock([program]: [AST.Block]) {
    this.templateId++;
    this.opcode(['startBlock', program], program);
  }

  endBlock() {
    this.templateIds.push(this.templateId - 1);
    this.opcode(['endBlock', null], null);
  }

  text([action]: [AST.TextNode]) {
    this.opcode(['text', action.chars], action);
  }

  comment([action]: [AST.CommentStatement]) {
    this.opcode(['comment', action.value], action);
  }

  openElement([action]: [AST.ElementNode]) {
    let attributes = action.attributes;
    let hasSplat = false;

    for (let i = 0; i < attributes.length; i++) {
      let attr = attributes[i];
      if (attr.name === '...attributes') {
        hasSplat = true;
        break;
      }
    }

    let actionIsComponent = false;

    if (isDynamicComponent(action)) {
      let head: PathHead, rest: string[];
      [head, ...rest] = action.tag.split('.');
      if (head === 'this') {
        head = 0;
      }
      this.opcode(['get', [head, rest]]);
      this.opcode(['openComponent', action], action);
      actionIsComponent = true;
    } else if (isNamedBlock(action)) {
      this.opcode(['openNamedBlock', action], action);
    } else if (isComponent(action)) {
      this.opcode(['openComponent', action], action);
      actionIsComponent = true;
    } else if (hasSplat) {
      this.opcode(['openSplattedElement', action], action);
    } else {
      this.opcode(['openElement', action], action);
    }

    if (!isNamedBlock(action)) {
      // TODO: Assert no attributes
      let typeAttr: Option<AST.AttrNode> = null;
      let attrs = action.attributes;
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i].name === 'type') {
          typeAttr = attrs[i];
          continue;
        }
        this.attribute([attrs[i]], hasSplat || actionIsComponent);
      }

      if (typeAttr) {
        this.attribute([typeAttr], hasSplat || actionIsComponent);
      }

      this.opcode(['flushElement', action], null);
    }
  }

  closeElement([action]: [AST.ElementNode]) {
    if (isDynamicComponent(action)) {
      this.opcode(['closeDynamicComponent', action], action);
    } else if (isNamedBlock(action)) {
      this.opcode(['closeNamedBlock', action]);
    } else if (isComponent(action)) {
      this.opcode(['closeComponent', action], action);
    } else if (action.modifiers.length > 0) {
      for (let i = 0; i < action.modifiers.length; i++) {
        this.modifier([action.modifiers[i]]);
      }
      this.opcode(['closeElement', action], action);
    } else {
      this.opcode(['closeElement', action], action);
    }
  }

  attribute([action]: [AST.AttrNode], isComponent: boolean) {
    let { name, value } = action;

    let namespace = getAttrNamespace(name);
    let isStatic = this.prepareAttributeValue(value);

    if (name.charAt(0) === '@') {
      // Arguments
      if (isStatic) {
        this.opcode(['staticArg', name], action);
      } else if (action.value.type === 'MustacheStatement') {
        this.opcode(['dynamicArg', name], action);
      } else {
        this.opcode(['dynamicArg', name], action);
      }
    } else {
      let isTrusting = isTrustedValue(value);

      if (isStatic && name === '...attributes') {
        this.opcode(['attrSplat', null], action);
      } else if (isStatic && !isComponent) {
        this.opcode(['staticAttr', [name, namespace]], action);
      } else if (isTrusting) {
        this.opcode(
          [isComponent ? 'trustingComponentAttr' : 'trustingAttr', [name, namespace]],
          action
        );
      } else if (action.value.type === 'MustacheStatement') {
        this.opcode([isComponent ? 'componentAttr' : 'dynamicAttr', [name, null]], action);
      } else {
        this.opcode([isComponent ? 'componentAttr' : 'dynamicAttr', [name, namespace]], action);
      }
    }
  }

  modifier([action]: [AST.ElementModifierStatement]) {
    assertIsSimplePath(action.call, this.source, action.loc, 'modifier');

    this.prepareInvocation(action);
    this.expr(action.call);
    this.opcode(['modifier', null], action);
  }

  mustacheContent([action]: [AST.MustacheContent]) {
    let { value } = action;

    if (isLiteral(value)) {
      this.mustacheContentExpression(action);
      this.opcode(['append', action.trusted], action);
    } else if (isYield(value)) {
      let to = assertValidYield(action);
      this.yield(to, action);
    } else if (isDebugger(value)) {
      assertValidDebuggerUsage(action);
      this.debugger('debugger', action);
    } else if (value.type === 'SubExpression') {
      throw new Error(`Unimplemented {{(...)}}`);
    } else {
      this.mustacheContentExpression(action);
    }
  }

  mustache([action]: [AST.MustacheStatement]) {
    let { call } = action;

    if (isLiteral(call)) {
      this.mustacheExpression(action);
      this.opcode(['append', action.trusted], action);
    } else if (isYield(call)) {
      let to = assertValidYield(action);
      this.yield(to, action);
    } else if (isPartial(call)) {
      let params = assertValidPartial(action);
      this.partial(params, action);
    } else if (isDebugger(call)) {
      assertValidDebuggerUsage(action);
      this.debugger('debugger', action);
    } else {
      this.mustacheExpression(action);
      this.opcode(['append', action.trusted], action);
    }
  }

  block([action /*, index, count*/]: [AST.BlockStatement]) {
    this.prepareInvocation(action);
    let templateId = this.templateIds.pop()!;
    let inverseId = action.inverse === null ? null : this.templateIds.pop()!;
    this.path(action.call);
    this.opcode(['block', [templateId, inverseId]], action);
  }

  /// Internal actions, not found in the original processed actions

  argReference([path]: [AST.ArgExpression]) {
    let { head, tail } = path;
    this.opcode(['get', [`@${head.name}`, tail && tail.map(t => t.name)]], path);
  }

  mustacheContentExpression(expr: AST.MustacheContent) {
    let { value: call } = expr;

    if (isLiteral(call)) {
      this.opcode(['literal', call.value], expr);
    } else if (isKeyword(call)) {
      this.keyword(call as AST.Call);
    } else if (isArgReference(call)) {
      this.argReference([call]);
    } else if (isSubExpression(call)) {
      throw new Error(`Not implemented {{(subexpr)}}`);
    } else if (isThis(call)) {
      if (call.tail) {
        this.opcode(['get', [0, call.tail.map(t => t.name)]], expr);
      } else {
        this.opcode(['get', [0]], expr);
      }
    } else if (this.options.strict) {
      let { head, tail } = call;
      this.opcode(
        [
          'freeVariable',
          [(head as AST.LocalReference).name, ...(tail ? tail.map(s => s.name) : [])],
        ],
        expr
      );
    } else {
      let { head, tail } = call;
      this.opcode(
        ['maybeGet', [(head as AST.LocalReference).name, tail ? tail.map(t => t.name) : null]],
        expr
      );
    }
  }

  mustacheExpression(expr: AST.MustacheStatement) {
    this.prepareInvocation(expr);
    this.expr(expr.call);
    this.opcode(['helper', null], expr);
  }

  /// Internal Syntax

  yield(to: string, action: AST.MustacheStatement | AST.MustacheContent) {
    if (action.type === 'MustacheStatement') this.prepareParams(action.params);
    this.opcode(['yield', to], action);
  }

  debugger(_name: string, action: AST.MustacheStatement | AST.MustacheContent) {
    this.opcode(['debugger', null], action);
  }

  hasBlock(name: string, action: AST.Call) {
    this.opcode(['hasBlock', name], action);
  }

  hasBlockParams(name: string, action: AST.Call) {
    this.opcode(['hasBlockParams', name], action);
  }

  partial(_params: AST.Expression[], action: AST.MustacheStatement) {
    this.prepareParams(action.params);
    this.opcode(['partial', null], action);
  }

  keyword(expr: AST.Call) {
    let { call } = expr;
    if (isHasBlock(call)) {
      let name = assertValidHasBlockUsage('TODO', expr);
      this.hasBlock(name, expr);
    } else if (isHasBlockParams(call)) {
      let name = assertValidHasBlockUsage('TODO', expr);
      this.hasBlockParams(name, expr);
    }
  }

  /// Expressions, invoked recursively from prepareParams and prepareHash

  SubExpression(expr: AST.SubExpression) {
    if (isKeyword(expr.call)) {
      this.keyword(expr);
    } else {
      this.prepareInvocation(expr);
      this.expr(expr.call);
      this.opcode(['helper', null], expr);
    }
  }

  PathExpression(expr: AST.PathExpression) {
    if (isArgReference(expr)) {
      this.argReference([expr]);
    } else if (expr.head.type === 'This') {
      this.opcode(['get', [0, expr.tail && expr.tail.map(t => t.name)]]);
    } else {
      this.opcode(['get', [expr.head.name, expr.tail && expr.tail.map(t => t.name)]]);
    }
  }

  StringLiteral(action: AST.StringLiteral) {
    this.opcode(['literal', action.value], action);
  }

  BooleanLiteral(action: AST.BooleanLiteral) {
    this.opcode(['literal', action.value], action);
  }

  NumberLiteral(action: AST.NumberLiteral) {
    this.opcode(['literal', action.value], action);
  }

  NullLiteral(action: AST.NullLiteral) {
    this.opcode(['literal', action.value], action);
  }

  UndefinedLiteral(action: AST.UndefinedLiteral) {
    this.opcode(['literal', action.value], action);
  }

  /// Utilities

  opcode<O extends SymbolInOp>(opcode: O, action: Option<AST.BaseNode | AST.CommonProgram> = null) {
    // TODO: This doesn't really work
    if (this.includeMeta && action) {
      (opcode as any).push(this.meta(action));
    }

    this.opcodes.push(opcode);
  }

  expr(expr: AST.Expression): void {
    (this[expr.type] as any)(expr);
  }

  path(expr: AST.PathExpression): void {
    this.PathExpression(expr);
  }

  prepareInvocation(expr: AST.Call) {
    assertIsSimplePath(expr.call, this.source, expr.loc, 'helper');

    let { params, hash } = expr;

    this.prepareHash(hash);
    this.prepareParams(params);
  }

  prepareParams(params: AST.Expression[]) {
    if (!params.length) {
      this.opcode(['literal', null], null);
      return;
    }

    for (let i = params.length - 1; i >= 0; i--) {
      let param = params[i];

      assert(this[param.type], `Unimplemented ${param.type} on TemplateCompiler`);
      (this[param.type] as any)(param);
    }

    this.opcode(['prepareArray', params.length], null);
  }

  prepareHash(hash: AST.Hash) {
    let pairs = hash.pairs;

    if (!pairs.length) {
      this.opcode(['literal', null], null);
      return;
    }

    for (let i = pairs.length - 1; i >= 0; i--) {
      let { key, value } = pairs[i];

      assert(this[value.type], `Unimplemented ${value.type} on TemplateCompiler`);
      (this[value.type] as any)(value);
      this.opcode(['literal', key], null);
    }

    this.opcode(['prepareObject', pairs.length], null);
  }

  prepareAttributeValue(value: AST.AttrNode['value']): value is AST.TextNode {
    // returns the static value if the value is static

    switch (value.type) {
      case 'TextNode':
        this.opcode(['literal', value.chars], value);
        return true;
      case 'MustacheStatement':
        this.attributeMustache([value]);
        return false;
      case 'MustacheContent':
        this.attributeMustacheContent([value]);
        return false;
      case 'ConcatStatement':
        this.prepareConcatParts(value.parts);
        this.opcode(['concat', null], value);
        return false;
    }
  }

  prepareConcatParts(parts: AST.ConcatStatement['parts']) {
    for (let i = parts.length - 1; i >= 0; i--) {
      let part = parts[i];

      if (part.type === 'MustacheStatement') {
        this.attributeMustache([part]);
      } else if (part.type === 'TextNode') {
        this.opcode(['literal', part.chars], null);
      }
    }

    this.opcode(['prepareArray', parts.length], null);
  }

  attributeMustache([action]: [AST.MustacheStatement]) {
    this.mustacheExpression(action);
  }

  attributeMustacheContent([action]: [AST.MustacheContent]) {
    this.mustacheContentExpression(action);
  }

  meta(node: AST.BaseNode | AST.CommonProgram) {
    let loc = node.loc;
    if (!loc) {
      return [];
    }

    let { source, start, end } = loc;
    return ['loc', [source || null, [start.line, start.column], [end.line, end.column]]];
  }
}

function isSubExpression(call: AST.Expression): call is AST.SubExpression {
  return call.type === 'SubExpression';
}

export function isSimple(path: AST.PathExpression, name: string): boolean {
  return path.head.type === 'LocalReference' && path.head.name === name;
}

export function isThis(expr: AST.Expression): expr is AST.PathExpression & { head: AST.This } {
  return expr.type === 'PathExpression' && expr.head.type === 'This';
}

function isSimplePath(
  expr: AST.Expression
): expr is AST.PathExpression & { head: AST.LocalReference } {
  return (
    expr.type === 'PathExpression' && expr.head.type === 'LocalReference' && expr.tail === null
  );
}

function isSimplePathNamed(
  expr: AST.Expression,
  name: string
): expr is AST.PathExpression & { head: AST.LocalReference } {
  return isSimplePath(expr) && expr.head.name === name;
}

function isYield(expr: AST.Expression) {
  return isSimplePathNamed(expr, 'yield');
}

function isPartial(expr: AST.Expression) {
  return isSimplePathNamed(expr, 'partial');
}

function isDebugger(expr: AST.Expression) {
  return isSimplePathNamed(expr, 'debugger');
}

function isHasBlock(expr: AST.Expression) {
  return isSimplePathNamed(expr, 'has-block');
}

function isHasBlockParams(expr: AST.Expression) {
  return isSimplePathNamed(expr, 'has-block-params');
}

export function isKeyword(expr: AST.Expression) {
  return isSimplePath(expr) && (isHasBlock(expr) || isHasBlockParams(expr));
}

export function isArgReference(expr: AST.Expression): expr is AST.ArgExpression {
  return expr.type === 'PathExpression' && expr.head.type === 'ArgReference';
}

function isDynamicComponent(element: AST.ElementNode): boolean {
  let open = element.tag.charAt(0);

  let [maybeLocal] = element.tag.split('.');
  let isNamedArgument = open === '@';
  let isLocal = element.symbols!.has(maybeLocal);
  let isThisPath = element.tag.indexOf('this.') === 0;

  return isLocal || isNamedArgument || isThisPath;
}

function isComponent(element: AST.ElementNode): boolean {
  let open = element.tag.charAt(0);
  let isPath = element.tag.indexOf('.') > -1;

  let isUpperCase = open === open.toUpperCase() && open !== open.toLowerCase();

  return (isUpperCase && !isPath) || isDynamicComponent(element);
}

function isNamedBlock(element: AST.ElementNode): boolean {
  let open = element.tag.charAt(0);

  return open === ':';
}

function assertIsSimplePath(
  path: AST.Expression,
  source: string,
  loc: AST.SourceLocation,
  context: string
) {
  if (!isSimplePath(path)) {
    throw new SyntaxError(
      `\`${source.slice(
        path.span.start,
        path.span.end
      )}\` is not a valid name for a ${context} on line ${loc.start.line}.`,
      path.loc
    );
  }
}

function assertValidYield(statement: AST.MustacheStatement | AST.MustacheContent): string {
  if (statement.type === 'MustacheContent') return 'default';

  let { pairs } = statement.hash;

  if ((pairs.length === 1 && pairs[0].key !== 'to') || pairs.length > 1) {
    throw new SyntaxError(`yield only takes a single named argument: 'to'`, statement.loc);
  } else if (pairs.length === 1 && pairs[0].value.type !== 'StringLiteral') {
    throw new SyntaxError(`you can only yield to a literal value`, statement.loc);
  } else if (pairs.length === 0) {
    return 'default';
  } else {
    return (pairs[0].value as AST.StringLiteral).value;
  }
}

function assertValidPartial(statement: AST.MustacheStatement) /* : expr */ {
  let { params, hash, trusted, loc } = statement;

  if (params && params.length !== 1) {
    throw new SyntaxError(
      `Partial found with no arguments. You must specify a template name. (on line ${
        loc.start.line
      })`,
      statement.loc
    );
  } else if (hash && hash.pairs.length > 0) {
    throw new SyntaxError(
      `partial does not take any named arguments (on line ${loc.start.line})`,
      statement.loc
    );
  } else if (trusted) {
    throw new SyntaxError(
      `{{{partial ...}}} is not supported, please use {{partial ...}} instead (on line ${
        loc.start.line
      })`,
      statement.loc
    );
  }

  return params;
}

function assertValidHasBlockUsage(type: string, call: AST.Call): string {
  let { params, hash, loc } = call;

  if (hash && hash.pairs.length > 0) {
    throw new SyntaxError(`${type} does not take any named arguments`, call.loc);
  }

  if (params.length === 0) {
    return 'default';
  } else if (params.length === 1) {
    let param = params[0];
    if (param.type === 'StringLiteral') {
      return param.value;
    } else {
      throw new SyntaxError(
        `you can only yield to a literal value (on line ${loc.start.line})`,
        call.loc
      );
    }
  } else {
    throw new SyntaxError(
      `${type} only takes a single positional argument (on line ${loc.start.line})`,
      call.loc
    );
  }
}

function assertValidDebuggerUsage(statement: AST.MustacheStatement | AST.MustacheContent) {
  if (statement.type === 'MustacheContent') return 'default';

  let { params, hash } = statement;

  if (hash && hash.pairs.length > 0) {
    throw new SyntaxError(`debugger does not take any named arguments`, statement.loc);
  }

  if (params.length === 0) {
    return 'default';
  } else {
    throw new SyntaxError(`debugger does not take any positional arguments`, statement.loc);
  }
}
