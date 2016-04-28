import { FIXME, Opaque, Slice, LinkedList, InternedString } from 'glimmer-util';
import { OpSeq, Opcode } from './opcodes';
import {
  OpenPrimitiveElementOpcode,
  OpenDynamicPrimitiveElementOpcode,
  CloseElementOpcode
} from './compiled/opcodes/dom';
import {
  DidCreateElementOpcode,
  PutComponentDefinitionOpcode,
  ShadowAttributesOpcode,
  OpenDynamicComponentOpcode
} from './compiled/opcodes/component';
import {
  BindNamedArgsOpcode,
  BindBlocksOpcode,
  BindPositionalArgsOpcode,
  EnterOpcode,
  ExitOpcode,
  LabelOpcode,
  PutArgsOpcode,
  PutValueOpcode
} from './compiled/opcodes/vm';

import * as Syntax from './syntax/core';
import { Environment } from './environment';
import SymbolTable from './symbol-table';
import { Block, CompiledBlock, EntryPoint, InlineBlock, Layout } from './compiled/blocks';

import {
  OpenComponentOpcode,
  CloseComponentOpcode
} from './compiled/opcodes/component';

import OpcodeBuilder, {
  StaticComponentOptions,
  DynamicComponentOptions
} from './opcode-builder';

import {
  Statement as StatementSyntax,
  Attribute as AttributeSyntax,
  StatementCompilationBuffer,
  SymbolLookup,
  CompileInto
} from './syntax';

import {
  FunctionExpression,
  default as makeFunctionExpression
} from './compiled/expressions/function';

import OpcodeBuilderDSL from './compiled/opcodes/builder';

import * as Component from './component/interfaces';
import { CACHED_LAYOUT } from './component/interfaces';

abstract class Compiler {
  public env: Environment;
  protected block: Block;
  protected symbolTable: SymbolTable;
  protected current: StatementSyntax;

  constructor(block: Block, env: Environment) {
    this.block = block;
    this.current = block.program.head();
    this.env = env;
    this.symbolTable = block.symbolTable;
  }

  protected compileStatement(statement: StatementSyntax, ops: OpcodeBuilderDSL) {
    this.env.statement(statement).compile(ops, this.env);
  }
}

function compileStatement(env: Environment, statement: StatementSyntax, ops: OpcodeBuilderDSL) {
  env.statement(statement).compile(ops, env);
}

export default Compiler;

export class EntryPointCompiler extends Compiler {
  private ops: OpcodeBuilderDSL;
  protected block: EntryPoint;

  constructor(template: EntryPoint, env: Environment) {
    super(template, env);
    let list = new CompileIntoList(env, template.symbolTable);
    this.ops = new OpcodeBuilderDSL(list, env);
  }

  compile(): OpSeq {
    let { block, ops } = this;
    let { program } = block;

    let current = program.head();

    while (current) {
      let next = program.nextNode(current);
      this.compileStatement(current, ops);
      current = next;
    }

    return ops.toOpSeq();
  }

  append(op: Opcode) {
    this.ops.append(op);
  }

  getLocalSymbol(name: InternedString): number {
    return this.symbolTable.getLocal(name);
  }

  getNamedSymbol(name: InternedString): number {
    return this.symbolTable.getNamed(name);
  }

  getYieldSymbol(name: InternedString): number {
    return this.symbolTable.getYield(name);
  }
}

export class InlineBlockCompiler extends Compiler {
  private ops: OpcodeBuilderDSL;
  protected block: InlineBlock;
  protected current: StatementSyntax;

  constructor(block: InlineBlock, env: Environment) {
    super(block, env);
    let list = new CompileIntoList(env, block.symbolTable);
    this.ops = new OpcodeBuilderDSL(list, env);
  }

  compile(): OpSeq {
    let { block, ops } = this;
    let { program } = block;

    if (block.hasPositionalParameters()) {
      ops.bindPositionalArgs({ block });
    }

    let current = program.head();

    while (current) {
      let next = program.nextNode(current);
      this.compileStatement(current, ops);
      current = next;
    }

    return ops.toOpSeq();
  }
}

export interface ComponentParts {
  tag: InternedString;
  attrs: Slice<AttributeSyntax<Opaque>>;
  body: Slice<StatementSyntax>;
}

export interface CompiledComponentParts {
  tag: InternedString;
  preamble: CompileIntoList;
  main: CompileIntoList;
}

export function layoutFor(definition: Component.ComponentDefinition<any>, env: Environment): CompiledBlock {
  let layout = definition[CACHED_LAYOUT];
  if (layout) return layout;

  let builder = new ComponentLayoutBuilder(env);

  definition['compile'](builder);

  return definition[CACHED_LAYOUT] = builder.compile();
}

class ComponentLayoutBuilder implements Component.ComponentLayoutBuilder {
  public env: Environment;

  private inner: EmptyBuilder | WrappedBuilder | UnwrappedBuilder;

  constructor(env: Environment) {
    this.env = env;
  }

  empty() {
    this.inner = new EmptyBuilder(this.env);
  }

  wrapLayout(layout: Layout) {
    this.inner = new WrappedBuilder(this.env, layout);
  }

  fromLayout(layout: Layout) {
    this.inner = new UnwrappedBuilder(this.env, layout);
  }

  compile(): CompiledBlock {
    return this.inner.compile();
  }

  get tag(): Component.ComponentTagBuilder {
    return this.inner.tag;
  }

  get attrs(): Component.ComponentAttrsBuilder {
    return this.inner.attrs;
  }
}

class EmptyBuilder {
  public env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  get tag(): Component.ComponentTagBuilder {
    throw new Error('Nope');
  }

  get attrs(): Component.ComponentAttrsBuilder {
    throw new Error('Nope');
  }

  compile(): CompiledBlock {
    let { env } = this;

    let list = new CompileIntoList(env, null);
    return new CompiledBlock(list, 0);
  }
}

class WrappedBuilder {
  private layout: Layout;
  public env: Environment;

  public tag = new ComponentTagBuilder();
  public attrs = new ComponentAttrsBuilder();

  constructor(env: Environment, layout: Layout) {
    this.env = env;
    this.layout = layout;
  }

  compile(): CompiledBlock {
    let { env, layout } = this;

    let buffer = new CompileIntoList(env, layout.symbolTable);
    let list = new OpcodeBuilderDSL(buffer, env);

    if (layout.hasNamedParameters()) {
      list.append(BindNamedArgsOpcode.create(layout));
    }

    if (layout.hasYields()) {
      list.append(BindBlocksOpcode.create(layout));
    }

    if (this.tag.isDynamic) {
      let tag = makeFunctionExpression(this.tag.dynamicTagName);
      list.putValue({ expression: tag });
      list.openDynamicPrimitiveElement();
    } else {
      let tag = this.tag.staticTagName;
      list.openPrimitiveElement({ tag });
    }

    list.didCreateElement();

    this.attrs['buffer'].forEach(statement => compileStatement(env, statement, list));

    layout.program.forEachNode(statement => compileStatement(env, statement, list));

    list.closeElement();

    return new CompiledBlock(list.toOpSeq(), layout.symbolTable.size);
  }
}

class UnwrappedBuilder {
  private layout: Layout;
  public env: Environment;

  public attrs = new ComponentAttrsBuilder();

  constructor(env: Environment, layout: Layout) {
    this.env = env;
    this.layout = layout;
  }

  get tag(): Component.ComponentTagBuilder {
    throw new Error('BUG: Cannot call `tag` on an UnwrappedBuilder');
  }

  compile(): CompiledBlock {
    let { env, layout } = this;

    let buffer = new CompileIntoList(env, layout.symbolTable);
    let list = new OpcodeBuilderDSL(buffer, env);

    if (layout.hasNamedParameters()) {
      list.append(BindNamedArgsOpcode.create(layout));
    }

    if (layout.hasYields()) {
      list.append(BindBlocksOpcode.create(layout));
    }

    let attrs = this.attrs['buffer'];
    let attrsInserted = false;

    this.layout.program.forEachNode(statement => {
      compileStatement(env, statement, list);

      if (!attrsInserted && isOpenElement(statement)) {
        list.didCreateElement();
        list.shadowAttributes();
        attrs.forEach(statement => compileStatement(env, statement, list));
        attrsInserted = true;
      }
    });

    return new CompiledBlock(list.toOpSeq(), layout.symbolTable.size);
  }
}

type OpenElement = Syntax.OpenElement | Syntax.OpenPrimitiveElement;

function isOpenElement(syntax: StatementSyntax): syntax is OpenElement {
  return syntax instanceof Syntax.OpenElement || syntax instanceof Syntax.OpenPrimitiveElement;
}

class ComponentTagBuilder implements Component.ComponentTagBuilder {
  public isDynamic = null;
  public staticTagName: InternedString = null;
  public dynamicTagName: FunctionExpression<string> = null;

  static(tagName: InternedString) {
    this.isDynamic = false;
    this.staticTagName = tagName;
  }

  dynamic(tagName: FunctionExpression<string>) {
    this.isDynamic = true;
    this.dynamicTagName = tagName;
  }
}

class ComponentAttrsBuilder implements Component.ComponentAttrsBuilder {
  private buffer: AttributeSyntax<string>[] = [];

  static(name: string, value: string) {
    this.buffer.push(new Syntax.StaticAttr({ name: name as FIXME<'intern'>, value: value as FIXME<'intern'> }));
  }

  dynamic(name: string, value: FunctionExpression<string>) {
    this.buffer.push(new Syntax.DynamicAttr({ name: name as FIXME<'intern'>, value: makeFunctionExpression(value) }));
  }
}

class ComponentBuilder {
  private env: Environment;

  constructor(private dsl: OpcodeBuilderDSL) {
    this.env = dsl.env;
  }

  static({ definition, args, shadow, templates }: StaticComponentOptions) {
    let { dsl, env } = this;

    // let args = rawArgs.compile(dsl, env);
    dsl.openComponent({ definition, args, shadow, templates });
    dsl.closeComponent();
  }

  dynamic({ definition, args, shadow, templates }: DynamicComponentOptions) {
    let { dsl, env } = this;

    let BEGIN = dsl.label({ label: "BEGIN" });
    let END = dsl.label({ label: "END" });

    dsl.enter({ begin: BEGIN, end: END });
    dsl.append(BEGIN);
    dsl.putArgs({ args: definition.args });
    dsl.putComponentDefinition(definition)
    dsl.putArgs({ args: args });
    dsl.openDynamicComponent({ shadow, templates });
    dsl.closeComponent();
    dsl.append(END);
    dsl.exit();
  }
}

export class CompileIntoList extends LinkedList<Opcode> implements OpcodeBuilder, StatementCompilationBuffer {
  private env: Environment;
  private symbolTable: SymbolTable;

  public component: ComponentBuilder;

  constructor(env: Environment, symbolTable: SymbolTable) {
    super();
    this.env = env;
    this.symbolTable = symbolTable;

    let dsl = new OpcodeBuilderDSL(this, env);
    this.component = new ComponentBuilder(dsl);
  }

  getLocalSymbol(name: InternedString): number {
    return this.symbolTable.getLocal(name);
  }

  hasLocalSymbol(name: InternedString): boolean {
    return typeof this.symbolTable.getLocal(name) === 'number';
  }

  getNamedSymbol(name: InternedString): number {
    return this.symbolTable.getNamed(name);
  }

  hasNamedSymbol(name: InternedString): boolean {
    return typeof this.symbolTable.getNamed(name) === 'number';
  }

  getBlockSymbol(name: InternedString): number {
    return this.symbolTable.getYield(name);
  }

  hasBlockSymbol(name: InternedString): boolean {
    return typeof this.symbolTable.getYield(name) === 'number';
  }

  hasKeyword(name: InternedString): boolean {
    return this.env.hasKeyword(name);
  }

  toOpSeq(): OpSeq {
    return this;
  }
}
