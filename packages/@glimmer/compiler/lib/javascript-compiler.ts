import * as WireFormat from '@glimmer/wire-format';
import { assert } from "@glimmer/util";
import { Stack, DictSet, Option, expect } from "@glimmer/util";
import { AST } from '@glimmer/syntax';
import { BlockSymbolTable, ProgramSymbolTable } from './template-visitor';

import {
  TemplateMeta,
  SerializedTemplateBlock,
  SerializedTemplate,
  Core,
  Statement,
  Statements,
  Expression,
  Expressions,
  Ops
} from '@glimmer/wire-format';

export type str = string;
export type Params = Core.Params;
export type Hash = Core.Hash;
export type Path = Core.Path;
export type StackValue = Expression | Params | Hash | str;

export abstract class Block {
  public statements: Statement[] = [];

  abstract toJSON(): Object;

  push(statement: Statement) {
    this.statements.push(statement);
  }
}

export class InlineBlock extends Block {
  constructor(public table: BlockSymbolTable) {
    super();
  }

  toJSON(): WireFormat.SerializedInlineBlock {
    return {
      statements: this.statements,
      parameters: this.table.slots
    };
  }
}

export class TemplateBlock extends Block {
  public type = "template";
  public yields = new DictSet<string>();
  public named = new DictSet<string>();
  public blocks: WireFormat.SerializedInlineBlock[] = [];
  public hasEval = false;

  constructor(private symbolTable: ProgramSymbolTable) {
    super();
  }

  push(statement: Statement) {
    this.statements.push(statement);
  }

  toJSON(): SerializedTemplateBlock {
    return {
      symbols: this.symbolTable.symbols,
      statements: this.statements,
      hasEval: this.hasEval
    };
  }
}

export class ComponentBlock extends Block {
  public attributes: Statements.Attribute[] = [];
  public arguments: Statements.Argument[] = [];
  private inParams = true;
  public positionals: number[] = [];

  constructor(private table: BlockSymbolTable) {
    super();
  }

  push(statement: Statement) {
    if (this.inParams) {
      if (Statements.isFlushElement(statement)) {
        this.inParams = false;
      } else if (Statements.isArgument(statement)) {
        this.arguments.push(statement);
      } else if (Statements.isAttribute(statement)) {
        this.attributes.push(statement);
      } else if (Statements.isModifier(statement)) {
        throw new Error('Compile Error: Element modifiers are not allowed in components');
      } else {
        throw new Error('Compile Error: only parameters allowed before flush-element');
      }
    } else {
      this.statements.push(statement);
    }
  }

  toJSON(): [WireFormat.Statements.Attribute[], WireFormat.Core.Hash, Option<WireFormat.SerializedInlineBlock>] {
    let args = this.arguments;
    let keys = args.map(arg => arg[1]);
    let values = args.map(arg => arg[2]);

    return [
      this.attributes,
      [keys, values],
      {
        statements: this.statements,
        parameters: this.table.slots
      }
    ];
  }
}

export class Template<T extends TemplateMeta> {
  public block: TemplateBlock;

  constructor(symbols: ProgramSymbolTable, public strings: StringMap, public meta: T) {
    this.block = new TemplateBlock(symbols);
  }

  toJSON(): SerializedTemplate<T> {
    return {
      strings: this.strings.toJSON(),
      block: this.block.toJSON(),
      meta: this.meta
    };
  }
}

export class StringMap {
  strings: string[] = [];

  get(string: string): number {
    let foundIndex = this.strings.indexOf(string);
    if (foundIndex > -1) {
      return foundIndex;
    }

    return this.strings.push(string) - 1;
  }

  toJSON() {
    return this.strings;
  }
}

export default class JavaScriptCompiler<T extends TemplateMeta> {
  static process<T extends TemplateMeta>(opcodes: any[], symbols: ProgramSymbolTable, meta: T): Template<T> {
    let compiler = new JavaScriptCompiler<T>(opcodes, symbols, meta);
    return compiler.process();
  }

  private template: Template<T>;
  private blocks = new Stack<Block>();
  private opcodes: any[];
  private values: StackValue[] = [];
  private strings: StringMap = new StringMap();

  constructor(opcodes: any[], symbols: ProgramSymbolTable, meta: T) {
    this.opcodes = opcodes;
    this.template = new Template(symbols, this.strings, meta);
  }

  get currentBlock(): Block {
    return expect(this.blocks.current, 'Expected a block on the stack');
  }

  process(): Template<T> {
    this.opcodes.forEach(([opcode, ...args]) => {
      if (!this[opcode]) { throw new Error(`unimplemented ${opcode} on JavaScriptCompiler`); }
      this[opcode](...args);
    });

    return this.template;
  }

  /// Nesting

  startBlock([program]: [AST.Program]) {
    let block: Block = new InlineBlock(program['symbols']);
    this.blocks.push(block);
  }

  endBlock() {
    let { template, blocks } = this;
    let block = blocks.pop() as InlineBlock;
    template.block.blocks.push(block.toJSON());
  }

  startProgram() {
    this.blocks.push(this.template.block);
  }

  endProgram() {

  }

  /// Statements

  text(content: string) {
    let contentIndex = this.strings.get(content);
    this.push([Ops.Text, contentIndex]);
  }

  append(trusted: boolean) {
    this.push([Ops.Append, this.popValue<Expression>(), trusted]);
  }

  comment(value: string) {
    let valueIndex = this.strings.get(value);

    this.push([Ops.Comment, valueIndex]);
  }

  modifier(name: string) {
    let nameIndex = this.strings.get(name);
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    this.push([Ops.Modifier, nameIndex, params, hash]);
  }

  block(name: string, template: number, inverse: number) {
    let nameIndex = this.strings.get(name);
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    let blocks = this.template.block.blocks;
    assert(typeof template !== 'number' || blocks[template] !== null, 'missing block in the compiler');
    assert(typeof inverse !== 'number' || blocks[inverse] !== null, 'missing block in the compiler');

    this.push([Ops.Block, nameIndex, params, hash, blocks[template], blocks[inverse]]);
  }

  openElement(element: AST.ElementNode) {
    let tag = element.tag;

    if (tag.indexOf('-') !== -1) {
      this.startComponent(element);
    } else if (element.blockParams.length > 0) {
      throw new Error(`Compile Error: <${element.tag}> is not a component and doesn't support block parameters`);
    } else {
      let tagIndex = this.strings.get(tag);
      this.push([Ops.OpenElement, tagIndex]);
    }
  }

  flushElement() {
    this.push([Ops.FlushElement]);
  }

  closeElement(element: AST.ElementNode) {
    let tag = element.tag;

    if (tag.indexOf('-') !== -1) {
      let [attrs, args, block] = this.endComponent();
      let tagIndex = this.strings.get(tag);
      this.push([Ops.Component, tagIndex, attrs, args, block]);
    } else {
      this.push([Ops.CloseElement]);
    }
  }

  staticAttr(name: str, namespace: str) {
    let nameIndex = this.strings.get(name);
    let value = this.popValue<Expression>();

    this.push([Ops.StaticAttr, nameIndex, value, namespace]);
  }

  dynamicAttr(name: str, namespace: str) {
    let nameIndex = this.strings.get(name);
    let value = this.popValue<Expression>();

    this.push([Ops.DynamicAttr, nameIndex, value, namespace]);
  }

  trustingAttr(name: str, namespace: str) {
    let nameIndex = this.strings.get(name);
    let value = this.popValue<Expression>();

    this.push([Ops.TrustingAttr, nameIndex, value, namespace]);
  }

  staticArg(name: str) {
    let nameIndex = this.strings.get(name);
    let value = this.popValue<Expression>();

    this.push([Ops.StaticArg, nameIndex, value]);
  }

  dynamicArg(name: str) {
    let nameIndex = this.strings.get(name);
    let value = this.popValue<Expression>();

    this.push([Ops.DynamicArg, nameIndex, value]);
  }

  yield(to: number) {
    let params = this.popValue<Params>();
    this.push([Ops.Yield, to, params]);
  }

  debugger(evalInfo: Core.EvalInfo) {
    this.push([Ops.Debugger, evalInfo]);
    this.template.block.hasEval = true;
  }

  hasBlock(name: number) {
    this.pushValue<Expressions.HasBlock>([Ops.HasBlock, name]);
  }

  hasBlockParams(name: number) {
    this.pushValue<Expressions.HasBlockParams>([Ops.HasBlockParams, name]);
  }

  partial(evalInfo: Core.EvalInfo) {
    let params = this.popValue<Params>();
    this.push([Ops.Partial, params[0], evalInfo]);
    this.template.block.hasEval = true;
  }

  /// Expressions

  literal(value: Expressions.Value | undefined) {
    if (value === undefined) {
      this.pushValue<Expressions.Undefined>([Ops.Undefined]);
    } else {
      this.pushValue<Expressions.Value>(value);
    }
  }

  unknown(name: string) {
    let nameIndex = this.strings.get(name);
    this.pushValue<Expressions.Unknown>([Ops.Unknown, nameIndex]);
  }

  get(head: number, path: string[]) {
    let { strings } = this;
    let pathIndexes = path.map(str => strings.get(str));

    this.pushValue<Expressions.Get>([Ops.Get, head, pathIndexes]);
  }

  maybeLocal(path: string[]) {
    let { strings } = this;
    let pathIndexes = path.map(str => strings.get(str));

    this.pushValue<Expressions.MaybeLocal>([Ops.MaybeLocal, pathIndexes]);
  }

  concat() {
    this.pushValue<Expressions.Concat>([Ops.Concat, this.popValue<Params>()]);
  }

  helper(name: string) {
    let nameIndex = this.strings.get(name);
    let params = this.popValue<Params>();
    let hash = this.popValue<Hash>();

    this.pushValue<Expressions.Helper>([Ops.Helper, nameIndex, params, hash]);
  }

  /// Stack Management Opcodes

  startComponent(element: AST.ElementNode) {
    let component = new ComponentBlock(element['symbols']);
    this.blocks.push(component);
  }

  endComponent(): [WireFormat.Statements.Attribute[], WireFormat.Core.Hash, Option<WireFormat.SerializedInlineBlock>] {
    let component = this.blocks.pop();
    assert(component instanceof ComponentBlock, "Compiler bug: endComponent() should end a component");
    return (component as ComponentBlock).toJSON();
  }

  prepareArray(size: number) {
    let values: Expression[] = [];

    for (let i = 0; i < size; i++) {
      values.push(this.popValue() as Expression);
    }

    this.pushValue<Params>(values);
  }

  prepareObject(size: number) {
    assert(this.values.length >= size, `Expected ${size} values on the stack, found ${this.values.length}`);

    let keys: number[] = new Array(size);
    let values: Expression[] = new Array(size);

    for (let i = 0; i < size; i++) {
      let key = this.popValue<str>();
      let keyIndex = this.strings.get(key);
      keys[i] = keyIndex;
      values[i] = this.popValue<Expression>();
    }

    this.pushValue<Hash>([keys, values]);
  }

  /// Utilities

  push(args: Statement) {
    while (args[args.length - 1] === null) {
      args.pop();
    }

    this.currentBlock.push(args);
  }

  pushValue<S extends Expression | Params | Hash>(val: S) {
    this.values.push(val);
  }

  popValue<T extends StackValue>(): T {
    assert(this.values.length, "No expression found on stack");
    return this.values.pop() as T;
  }
}
