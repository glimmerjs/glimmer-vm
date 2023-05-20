import type {
  CompilableProgram,
  CompileTimeCompilationContext,
  ComponentDefinitionState,
  DynamicScope,
  ElementBuilder,
  Environment,
  ISTDLIB_MAIN,
  Owner,
  RenderResult,
  RichIteratorResult,
  RuntimeContext,
  TemplateIterator,
} from '@glimmer/interfaces';
import { childRefFor, createConstRef, type Reference } from '@glimmer/reference';
import { expect, unwrapHandle } from '@glimmer/util';
import { debug } from '@glimmer/validator';

import { inTransaction } from './environment';
import { DynamicScopeImpl } from './scope';
import { ARGS, CONSTANTS } from './symbols';
import { VM, type InternalVM } from './vm/append';

class TemplateIteratorImpl implements TemplateIterator {
  readonly #vm: InternalVM;

  constructor(vm: InternalVM) {
    this.#vm = vm;
  }

  next(): RichIteratorResult<null, RenderResult> {
    return this.#vm._next_();
  }

  sync(): RenderResult {
    return import.meta.env.DEV ? debug.runInTrackingTransaction!(() => this.#vm._execute_(), '- While rendering:') : this.#vm._execute_();
  }
}

export function renderSync(environment: Environment, iterator: TemplateIterator): RenderResult {
  let result: RenderResult;

  inTransaction(environment, () => (result = iterator.sync()));

  return result!;
}

export function renderMain(
  runtime: RuntimeContext,
  context: CompileTimeCompilationContext,
  owner: Owner,
  self: Reference,
  treeBuilder: ElementBuilder,
  layout: CompilableProgram,
  dynamicScope: DynamicScope = new DynamicScopeImpl()
): TemplateIterator {
  let handle = unwrapHandle(layout.compile(context));
  let numberSymbols = layout.symbolTable.symbols.length;
  let vm = VM.initial(runtime, context, {
    self,
    dynamicScope,
    treeBuilder,
    handle,
    numSymbols: numberSymbols,
    owner,
  });
  return new TemplateIteratorImpl(vm);
}

function renderInvocation(
  vm: InternalVM,
  context: CompileTimeCompilationContext,
  owner: Owner,
  definition: ComponentDefinitionState,
  args: Record<string, Reference>
): TemplateIterator {
  // Get a list of tuples of argument names and references, like
  // [['title', reference], ['name', reference]]
  let argumentList = Object.keys(args).map((key) => [key, args[key]] as const);

  let blockNames = ['main', 'else', 'attrs'];
  // Prefix argument names with `@` symbol
  let argumentNames = argumentList.map(([name]) => `@${name}`);

  let reified = vm[CONSTANTS].component(definition, owner);

  vm._pushFrame_();

  // Push blocks on to the stack, three stack values per block
  for (let index = 0; index < 3 * blockNames.length; index++) {
    vm.stack.push(null);
  }

  vm.stack.push(null);

  // For each argument, push its backing reference on to the stack
  for (let [, reference] of argumentList) {
    vm.stack.push(reference);
  }

  // Configure VM based on blocks and args just pushed on to the stack.
  vm[ARGS].setup(vm.stack, argumentNames, blockNames, 0, true);

  let compilable = expect(
    reified.compilable,
    'BUG: Expected the root component rendered with renderComponent to have an associated template, set with setComponentTemplate'
  );
  let layoutHandle = unwrapHandle(compilable.compile(context));
  let invocation = { handle: layoutHandle, symbolTable: compilable.symbolTable };

  // Needed for the Op.Main opcode: arguments, component invocation object, and
  // component definition.
  vm.stack.push(vm[ARGS], invocation, reified);

  return new TemplateIteratorImpl(vm);
}

export function renderComponent(
  runtime: RuntimeContext,
  treeBuilder: ElementBuilder,
  context: CompileTimeCompilationContext,
  owner: Owner,
  definition: ComponentDefinitionState,
  args: Record<string, unknown> = {},
  dynamicScope: DynamicScope = new DynamicScopeImpl()
): TemplateIterator {
  let vm = VM.empty(
    runtime,
    { treeBuilder, handle: 0 satisfies ISTDLIB_MAIN, dynamicScope, owner },
    context
  );
  return renderInvocation(vm, context, owner, definition, recordToReference(args));
}

function recordToReference(record: Record<string, unknown>): Record<string, Reference> {
  let root = createConstRef(record, 'args');

  return Object.keys(record).reduce((accumulator, key) => {
    accumulator[key] = childRefFor(root, key);
    return accumulator;
  }, {} as Record<string, Reference>);
}
