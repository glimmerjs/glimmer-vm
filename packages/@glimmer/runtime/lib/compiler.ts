import { Register } from '@glimmer/vm';
import { CompilationMeta, Specifier, ProgramSymbolTable } from '@glimmer/interfaces';
import { CompiledDynamicTopLevel, CompiledDynamicTemplate, LOLWUT, ZOMG } from './compiled/blocks';
import { Maybe, Option } from '@glimmer/util';
import { TemplateMeta } from '@glimmer/wire-format';
import { Template } from './template';
import { debugSlice } from './opcodes';
import { ATTRS_BLOCK } from './syntax/functions';
import { CompilationOptions, InputCompilationOptions } from './syntax/compilable-template';

import {
  ComponentArgs,
  ComponentBuilder as IComponentBuilder
} from './opcode-builder';

import OpcodeBuilderDSL, { LazyOpcodeBuilder } from './compiled/opcodes/builder';

import * as Component from './component/interfaces';

import { DEBUG } from "@glimmer/local-debug-flags";

export interface CompilableLayout {
  compile(builder: Component.ComponentLayoutBuilder): void;
}

export function compileLayout(compilable: CompilableLayout, options: InputCompilationOptions): LOLWUT<ProgramSymbolTable> {
  let builder = new ComponentLayoutBuilder(options);

  compilable.compile(builder);

  let { symbolTable, handle } = builder.compile();

  return { symbolTable, zomg: { compileStatic() { return { handle }; } } as any as ZOMG };
}

interface InnerLayoutBuilder {
  tag: Component.ComponentTagBuilder;
  compile(): CompiledDynamicTopLevel;
}

class ComponentLayoutBuilder implements Component.ComponentLayoutBuilder {
  private inner: InnerLayoutBuilder;

  constructor(public options: CompilationOptions) {}

  wrapLayout(layout: Template<TemplateMeta>) {
    this.inner = new WrappedBuilder(this.options, layout);
  }

  fromLayout(componentName: string, layout: Template<TemplateMeta>) {
    this.inner = new UnwrappedBuilder(this.options, componentName, layout);
  }

  compile(): CompiledDynamicTopLevel {
    return this.inner.compile();
  }

  get tag(): Component.ComponentTagBuilder {
    return this.inner.tag;
  }
}

class WrappedBuilder implements InnerLayoutBuilder {
  public tag = new ComponentTagBuilder();

  constructor(public options: CompilationOptions, private layout: Template<TemplateMeta>) {}

  compile(): CompiledDynamicTopLevel {
    //========DYNAMIC
    //        PutValue(TagExpr)
    //        Test
    //        JumpUnless(BODY)
    //        OpenDynamicPrimitiveElement
    //        DidCreateElement
    //        ...attr statements...
    //        FlushElement
    // BODY:  Noop
    //        ...body statements...
    //        PutValue(TagExpr)
    //        Test
    //        JumpUnless(END)
    //        CloseElement
    // END:   Noop
    //        DidRenderLayout
    //        Exit
    //
    //========STATIC
    //        OpenPrimitiveElementOpcode
    //        DidCreateElement
    //        ...attr statements...
    //        FlushElement
    //        ...body statements...
    //        CloseElement
    //        DidRenderLayout
    //        Exit

    let { options, layout } = this;
    let meta = { templateMeta: layout.meta, symbols: layout.symbols, asPartial: false };

    let dynamicTag = this.tag.isDynamic;
    let staticTag = this.tag.getStatic();

    let b = builder(options, meta);

    b.startLabels();

    if (dynamicTag) {
      b.fetch(Register.s1);

      b.getComponentTagName(Register.s0);
      b.primitiveReference();

      b.dup();
      b.load(Register.s1);

      b.jumpUnless('BODY');

      b.fetch(Register.s1);
      b.putComponentOperations();
      b.openDynamicElement();
    } else if (staticTag) {
      b.putComponentOperations();
      b.openElementWithOperations(staticTag);
    }

    if (dynamicTag || staticTag) {
      b.didCreateElement(Register.s0);
      b.flushElement();
    }

    b.label('BODY');
    b.invokeStaticBlock(layout.asBlock());

    if (dynamicTag) {
      b.fetch(Register.s1);
      b.jumpUnless('END');
      b.closeElement();
    } else if (staticTag) {
      b.closeElement();
    }

    b.label('END');

    b.didRenderLayout(Register.s0);

    if (dynamicTag) {
      b.load(Register.s1);
    }

    b.stopLabels();

    let handle = b.commit(options.program.heap);

    if (DEBUG) {
      let { program, program: { heap } } = options;
      let start = heap.getaddr(handle);
      let end = start + heap.sizeof(handle);
      debugSlice(program, start, end);
    }

    return new CompiledDynamicTemplate(handle, {
      meta,
      hasEval: layout.hasEval,
      symbols: layout.symbols.concat([ATTRS_BLOCK])
    });
  }
}

class UnwrappedBuilder implements InnerLayoutBuilder {
  constructor(public env: CompilationOptions, private componentName: string, private layout: Template<TemplateMeta>) {}

  get tag(): Component.ComponentTagBuilder {
    throw new Error('BUG: Cannot call `tag` on an UnwrappedBuilder');
  }

  compile(): CompiledDynamicTopLevel {
    let { layout } = this;
    return layout.asLayout(this.componentName).compileDynamic();
  }
}

class ComponentTagBuilder implements Component.ComponentTagBuilder {
  public isDynamic: Option<boolean> = null;
  public isStatic: Option<boolean> = null;
  public staticTagName: Option<string> = null;

  getStatic(): Maybe<string> {
    if (this.isStatic) {
      return this.staticTagName;
    }
  }

  static(tagName: string) {
    this.isStatic = true;
    this.staticTagName = tagName;
  }

  dynamic() {
    this.isDynamic = true;
  }
}

export class ComponentBuilder implements IComponentBuilder {
  private env: CompilationOptions;

  constructor(private builder: OpcodeBuilderDSL) {
    this.env = builder.options;
  }

  static(definition: Specifier, args: ComponentArgs) {
    let [params, hash, _default, inverse] = args;
    let { builder } = this;

    builder.pushComponentManager(definition);
    builder.invokeComponent(null, params, hash, false, _default, inverse);
  }
}

export function builder(env: CompilationOptions, meta: CompilationMeta) {
  return new LazyOpcodeBuilder(env, meta);
}
