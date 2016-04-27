import * as component from './component';
import * as content from './content';
import * as dom from './dom';
import * as lists from './lists';
import * as vm from './vm';
import * as Syntax from '../../syntax/core';

import { Opaque, InternedString } from 'glimmer-util';
import { Insertion } from '../../upsert';
import { Expression, CompileInto, StatementCompilationBuffer } from '../../syntax';
import { Opcode, OpSeq } from '../../opcodes';
import { CompiledArgs } from '../expressions/args';
import { CompiledExpression } from '../expressions';
import { ComponentDefinition } from '../../component/interfaces';
import InnerOpcodeBuilder from '../../opcode-builder';
import Environment from '../../environment';

interface CompilesInto<T> {
  compile(dsl: OpcodeBuilder, env: Environment): T;
}

class StatementCompilationBufferProxy implements StatementCompilationBuffer {
  constructor(protected inner: StatementCompilationBuffer) {}

  get component() {
    return this.inner.component;
  }

  toOpSeq(): OpSeq {
    return this.inner.toOpSeq();
  }

  append<T extends Opcode>(opcode: T) {
    this.inner.append(opcode);
  }

  getLocalSymbol(name: InternedString): number {
    return this.inner.getLocalSymbol(name);
  }

  hasLocalSymbol(name: InternedString): boolean {
    return this.inner.hasLocalSymbol(name);
  }

  getNamedSymbol(name: InternedString): number {
    return this.inner.getNamedSymbol(name);
  }

  hasNamedSymbol(name: InternedString): boolean {
    return this.inner.hasNamedSymbol(name);
  }

  getBlockSymbol(name: InternedString): number {
    return this.inner.getBlockSymbol(name);
  }

  hasBlockSymbol(name: InternedString): boolean {
    return this.inner.hasBlockSymbol(name);
  }

  // only used for {{view.name}}
  hasKeyword(name: InternedString): boolean {
    return this.inner.hasKeyword(name);
  }
}

interface OpenComponentOptions {
  definition: ComponentDefinition<any>;
  args: CompilesInto<CompiledArgs>;
  shadow: InternedString[];
  templates: Syntax.Templates;
}


export class BasicOpcodeBuilder extends StatementCompilationBufferProxy {
  constructor(inner: StatementCompilationBuffer, public env: Environment) {
    super(inner);
  }

  // components

  putComponentDefinition(options: { factory: component.DynamicComponentFactory<Opaque> }) {
    this.append(new component.PutComponentDefinitionOpcode(options));
  }

  openDynamicComponent(options: component.OpenDynamicComponentOptions) {
    this.append(new component.OpenDynamicComponentOpcode(options));
  }

  openComponent({ definition, args, shadow, templates }: OpenComponentOptions) {
    this.append(new component.OpenComponentOpcode({
      definition,
      args: args.compile(this, this.env),
      shadow,
      templates
    }));
  }

  didCreateElement() {
    this.append(new component.DidCreateElementOpcode());
  }

  shadowAttributes() {
    this.append(new component.ShadowAttributesOpcode());
  }

  closeComponent() {
    this.append(new component.CloseComponentOpcode());
  }

  // content

  cautiousAppend() {
    this.append(new content.CautiousAppendOpcode());
  }

  trustingAppend() {
    this.append(new content.TrustingAppendOpcode());
  }

  // dom

  text(options: { text: InternedString }) {
    this.append(new dom.TextOpcode(options));
  }

  openPrimitiveElement(options: { tag: InternedString }) {
    this.append(new dom.OpenPrimitiveElementOpcode(options));
  }

  openDynamicPrimitiveElement() {
    this.append(new dom.OpenDynamicPrimitiveElementOpcode());
  }

  closeElement() {
    this.append(new dom.CloseElementOpcode());
  }

  staticAttr(options: dom.StaticAttrOptions) {
    this.append(new dom.StaticAttrOpcode(options));
  }

  dynamicAttrNS(options: dom.DynamicAttrNSOptions) {
    this.append(new dom.DynamicAttrNSOpcode(options));
  }

  dynamicAttr(options: dom.SimpleAttrOptions) {
    this.append(new dom.DynamicAttrOpcode(options));
  }

  dynamicProp(options: dom.SimpleAttrOptions) {
    this.append(new dom.DynamicPropOpcode(options));
  }

  comment(options: dom.CommentOptions) {
    this.append(new dom.CommentOpcode(options));
  }

  // lists

  putIterator() {
    this.append(new lists.PutIteratorOpcode());
  }

  enterList({ start, end }: { start: vm.LabelOpcode, end: vm.LabelOpcode }) {
    this.append(new lists.EnterListOpcode(start, end));
  }

  exitList() {
    this.append(new lists.ExitListOpcode());
  }

  enterWithKey({ start, end }: { start: vm.LabelOpcode, end: vm.LabelOpcode }) {
    this.append(new lists.EnterWithKeyOpcode(start, end));
  }

  nextIter({ end }: { end: vm.LabelOpcode }) {
    this.append(new lists.NextIterOpcode(end));
  }

  // vm

  pushChildScope() {
    this.append(new vm.PushChildScopeOpcode());
  }

  pushRootScope(options: vm.PushRootScopeOptions) {
    this.append(new vm.PushRootScopeOpcode(options));
  }

  popScope() {
    this.append(new vm.PopScopeOpcode());
  }

  pushDynamicScope() {
    this.append(new vm.PushDynamicScopeOpcode());
  }

  popDynamicScope() {
    this.append(new vm.PopDynamicScopeOpcode());
  }

  putNull() {
    this.append(new vm.PutNullOpcode());
  }

  putValue({ expression }: { expression: CompilesInto<CompiledExpression<Opaque>> }) {
    this.append(new vm.PutValueOpcode({ expression: expression.compile(this, this.env) }));
  }

  putArgs({ args }: { args: CompilesInto<CompiledArgs> }) {
    this.append(new vm.PutArgsOpcode({ args: args.compile(this, this.env) }));
  }

  bindPositionalArgs(options: vm.BindPositionalArgsOptions) {
    this.append(new vm.BindPositionalArgsOpcode(options));
  }

  bindNamedArgs(options: vm.BindNamedArgsOptions) {
    this.append(new vm.BindNamedArgsOpcode(options));
  }

  bindBlocks(options: vm.BindBlocksOptions) {
    this.append(new vm.BindBlocksOpcode(options));
  }

  bindDynamicScope({ callback }: { callback: vm.BindDynamicScopeCallback }) {
    this.append(new vm.BindDynamicScopeOpcode(callback));
  }

  enter(options: vm.EnterOptions) {
    this.append(new vm.EnterOpcode(options));
  }

  exit() {
    this.append(new vm.ExitOpcode());
  }

  label(options: vm.LabelOptions): vm.LabelOpcode {
    return new vm.LabelOpcode(options);
  }

  evaluate(options: vm.EvaluateOptions) {
    this.append(new vm.EvaluateOpcode(options));
  }

  test() {
    this.append(new vm.TestOpcode());
  }

  jump(options: vm.JumpOptions) {
    this.append(new vm.JumpOpcode(options));
  }

  jumpIf(options: vm.JumpOptions) {
    this.append(new vm.JumpIfOpcode(options));
  }

  jumpUnless(options: vm.JumpOptions) {
    this.append(new vm.JumpUnlessOpcode(options));
  }
}

export default class OpcodeBuilder extends BasicOpcodeBuilder {

}