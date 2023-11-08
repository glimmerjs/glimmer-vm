import type {
  CompilableProgram,
  ComponentDefinitionState,
  Description,
  DynamicScope,
  ElementBuilder,
  Environment,
  Invocation,
  JitContext,
  Owner,
  RenderResult,
  RichIteratorResult,
  RuntimeContext,
  TemplateIterator,
} from '@glimmer/interfaces';
import { getReactiveProperty, ReadonlyCell, type SomeReactive } from '@glimmer/reference';
import { expect, unwrapHandle } from '@glimmer/util';
import { debug } from '@glimmer/validator';

import { inTransaction } from './environment';
import { DynamicScopeImpl } from './scope';
import { type InternalVM, VM } from './vm/append';

class TemplateIteratorImpl implements TemplateIterator {
  constructor(private vm: InternalVM) {}
  next(): RichIteratorResult<null, RenderResult> {
    return this.vm.next();
  }

  sync(): RenderResult {
    if (import.meta.env.DEV) {
      return debug.runInTrackingTransaction!(() => this.vm.execute(), {
        kind: 'template',
        label: ['- While rendering:'],
      } satisfies Description);
    } else {
      return this.vm.execute();
    }
  }
}

export function renderSync(env: Environment, iterator: TemplateIterator): RenderResult {
  let result: RenderResult;

  inTransaction(env, () => (result = iterator.sync()));

  return result!;
}

export function renderMain(
  runtime: RuntimeContext,
  context: JitContext,
  owner: Owner,
  self: SomeReactive,
  treeBuilder: ElementBuilder,
  layout: CompilableProgram,
  dynamicScope: DynamicScope = new DynamicScopeImpl()
): TemplateIterator {
  let handle = unwrapHandle(layout.compile(context));
  let numSymbols = layout.symbolTable.symbols.length;
  let vm = VM.initial(runtime, context, {
    self,
    dynamicScope,
    treeBuilder,
    handle,
    numSymbols,
    owner,
  });
  return new TemplateIteratorImpl(vm);
}

function renderInvocation(
  vm: InternalVM,
  _context: JitContext,
  owner: Owner,
  definition: ComponentDefinitionState,
  args: Record<string, SomeReactive>
): TemplateIterator {
  // Get a list of tuples of argument names and references, like [['title', reference], ['name',
  // reference]]
  const argList = Object.keys(args).map((key) => [key, args[key]] as const);

  const blockNames = ['main', 'else', 'attrs'];
  // Prefix argument names with `@` symbol
  const argNames = argList.map(([name]) => `@${name}`);

  let reified = vm.constants.component(definition, owner);

  vm.pushFrame();

  // Push blocks on to the stack, three stack values per block
  for (let i = 0; i < 3 * blockNames.length; i++) {
    vm.stack.push(null);
  }

  vm.stack.push(null);

  // For each argument, push its backing reference on to the stack
  argList.forEach(([, reference]) => {
    vm.stack.push(reference);
  });

  // Configure VM based on blocks and args just pushed on to the stack.
  vm.args.setup(vm.argumentsStack, argNames, blockNames, 0, true);

  const compilable = expect(
    reified.compilable,
    'BUG: Expected the root component rendered with renderComponent to have an associated template, set with setComponentTemplate'
  );
  const layoutHandle = unwrapHandle(vm.compile(compilable));
  const invocation: Invocation = {
    handle: layoutHandle,
    symbolTable: compilable.symbolTable,
    meta: compilable.meta,
  };

  // Needed for the Op.Main opcode: arguments, component invocation object, and component
  // definition.
  vm.stack.push(vm.args);
  vm.stack.push(invocation);
  vm.stack.push(reified);

  vm.debugWillCall?.(invocation.handle);

  return new TemplateIteratorImpl(vm);
}

export function renderComponent(
  runtime: RuntimeContext,
  treeBuilder: ElementBuilder,
  context: JitContext,
  owner: Owner,
  definition: ComponentDefinitionState,
  args: Record<string, unknown> = {},
  dynamicScope: DynamicScope = new DynamicScopeImpl()
): TemplateIterator {
  let vm = VM.initial(runtime, context, {
    treeBuilder,
    self: undefined,
    handle: context.stdlib.main,
    dynamicScope,
    owner,
  });
  return renderInvocation(vm, context, owner, definition, recordToReference(args));
}

function recordToReference(record: Record<string, unknown>): Record<string, SomeReactive> {
  const root = ReadonlyCell(record, 'args');

  return Object.keys(record).reduce(
    (acc, key) => {
      acc[key] = getReactiveProperty(root, key);
      return acc;
    },
    {} as Record<string, SomeReactive>
  );
}
