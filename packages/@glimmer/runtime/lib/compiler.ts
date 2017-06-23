import { Register } from '@glimmer/vm';
import { CompilationMeta, Specifier } from '@glimmer/interfaces';
import { CompiledDynamicProgram, CompiledDynamicTemplate } from './compiled/blocks';
import { Maybe, Option } from '@glimmer/util';
import { Ops, TemplateMeta } from '@glimmer/wire-format';
import { Template } from './template';
import { debugSlice } from './opcodes';
import { ATTRS_BLOCK, compileStatement } from './syntax/functions';
import * as ClientSide from './syntax/client-side';
import { CompilationOptions, InputCompilationOptions } from './syntax/compilable-template';

import {
  ComponentArgs,
  ComponentBuilder as IComponentBuilder
} from './opcode-builder';

import { expr } from './syntax/functions';

import OpcodeBuilderDSL, { LazyOpcodeBuilder } from './compiled/opcodes/builder';

import * as Component from './component/interfaces';

import * as WireFormat from '@glimmer/wire-format';

import { FunctionExpression } from "./compiled/opcodes/expressions";
import { DEBUG } from "@glimmer/local-debug-flags";

export interface CompilableLayout {
  compile(builder: Component.ComponentLayoutBuilder): void;
}

export function compileLayout(compilable: CompilableLayout, options: InputCompilationOptions): CompiledDynamicProgram {
  let builder = new ComponentLayoutBuilder(options);

  compilable.compile(builder);

  return builder.compile();
}

interface InnerLayoutBuilder {
  tag: Component.ComponentTagBuilder;
  attrs: Component.ComponentAttrsBuilder;
  compile(): CompiledDynamicProgram;
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

  compile(): CompiledDynamicProgram {
    return this.inner.compile();
  }

  get tag(): Component.ComponentTagBuilder {
    return this.inner.tag;
  }

  get attrs(): Component.ComponentAttrsBuilder {
    return this.inner.attrs;
  }
}

class WrappedBuilder implements InnerLayoutBuilder {
  public tag = new ComponentTagBuilder();
  public attrs = new ComponentAttrsBuilder();

  constructor(public options: CompilationOptions, private layout: Template<TemplateMeta>) {}

  compile(): CompiledDynamicProgram {
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

    let dynamicTag = this.tag.getDynamic();
    let staticTag = this.tag.getStatic();

    let b = builder(options, meta);

    b.startLabels();

    if (dynamicTag) {
      b.fetch(Register.s1);

      expr(dynamicTag, b);

      b.dup();
      b.load(Register.s1);

      b.test('simple');

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

      let attrs = this.attrs.buffer;

      b.setComponentAttrs(true);

      for (let i=0; i<attrs.length; i++) {
        compileStatement(attrs[i], b);
      }

      b.setComponentAttrs(false);

      b.flushElement();
    }

    b.label('BODY');
    b.invokeStaticBlock(layout.asBlock());

    if (dynamicTag) {
      b.fetch(Register.s1);
      b.test('simple');
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

    let handle = b.finalize();

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
  public attrs = new ComponentAttrsBuilder();

  constructor(public env: CompilationOptions, private componentName: string, private layout: Template<TemplateMeta>) {}

  get tag(): Component.ComponentTagBuilder {
    throw new Error('BUG: Cannot call `tag` on an UnwrappedBuilder');
  }

  compile(): CompiledDynamicProgram {
    let { layout } = this;
    return layout.asLayout(this.componentName, this.attrs.buffer).compileDynamic();
  }
}

class ComponentTagBuilder implements Component.ComponentTagBuilder {
  public isDynamic: Option<boolean> = null;
  public isStatic: Option<boolean> = null;
  public staticTagName: Option<string> = null;
  public dynamicTagName: Option<WireFormat.Expression> = null;

  getDynamic(): Maybe<WireFormat.Expression> {
    if (this.isDynamic) {
      return this.dynamicTagName;
    }
  }

  getStatic(): Maybe<string> {
    if (this.isStatic) {
      return this.staticTagName;
    }
  }

  static(tagName: string) {
    this.isStatic = true;
    this.staticTagName = tagName;
  }

  dynamic(tagName: FunctionExpression<string>) {
    this.isDynamic = true;
    this.dynamicTagName = [Ops.ClientSideExpression, ClientSide.Ops.FunctionExpression, tagName];
  }
}

class ComponentAttrsBuilder implements Component.ComponentAttrsBuilder {
  public buffer: WireFormat.Statements.Attribute[] = [];

  static(name: string, value: string) {
    this.buffer.push([Ops.StaticAttr, name, value, null]);
  }

  dynamic(name: string, value: FunctionExpression<string>) {
    this.buffer.push([Ops.DynamicAttr, name, [Ops.ClientSideExpression, ClientSide.Ops.FunctionExpression, value], null]);
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
