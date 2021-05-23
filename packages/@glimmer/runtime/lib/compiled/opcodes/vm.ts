import { toBool } from '@glimmer/global-context';
import { CompilableTemplate, Option, Op, UpdatingOpcode, Source } from '@glimmer/interfaces';
import {
  createPrimitiveSource,
  UNDEFINED_SOURCE,
  NULL_SOURCE,
  TRUE_SOURCE,
  FALSE_SOURCE,
} from '@glimmer/reference';
import { createCache, getValue, isConst, createConstStorage } from '@glimmer/validator';
import { assert, decodeHandle, decodeImmediate, expect, isHandle } from '@glimmer/util';
import {
  CheckNumber,
  check,
  CheckInstanceof,
  CheckOption,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckPrimitive,
} from '@glimmer/debug';
import { stackAssert } from './assert';
import { APPEND_OPCODES } from '../../opcodes';
import { UpdatingVM } from '../../vm';
import { VMArgumentsImpl } from '../../vm/arguments';
import { CheckSource, CheckScope } from './-debug-strip';
import { CONSTANTS } from '../../symbols';
import { InternalVM } from '../../vm/append';

APPEND_OPCODES.add(Op.ChildScope, (vm) => vm.pushChildScope());

APPEND_OPCODES.add(Op.PopScope, (vm) => vm.popScope());

APPEND_OPCODES.add(Op.PushDynamicScope, (vm) => vm.pushDynamicScope());

APPEND_OPCODES.add(Op.PopDynamicScope, (vm) => vm.popDynamicScope());

APPEND_OPCODES.add(Op.Constant, (vm, { op1: other }) => {
  vm.stack.push(vm[CONSTANTS].getValue(decodeHandle(other)));
});

APPEND_OPCODES.add(Op.ConstantReference, (vm, { op1: other }) => {
  vm.stack.push(createConstStorage(vm[CONSTANTS].getValue(decodeHandle(other))));
});

APPEND_OPCODES.add(Op.Primitive, (vm, { op1: primitive }) => {
  let stack = vm.stack;

  if (isHandle(primitive)) {
    // it is a handle which does not already exist on the stack
    let value = vm[CONSTANTS].getValue(decodeHandle(primitive));
    stack.push(value as object);
  } else {
    // is already an encoded immediate or primitive handle
    stack.push(decodeImmediate(primitive));
  }
});

APPEND_OPCODES.add(Op.PrimitiveReference, (vm) => {
  let stack = vm.stack;
  let value = check(stack.pop(), CheckPrimitive);
  let ref;

  if (value === undefined) {
    ref = UNDEFINED_SOURCE;
  } else if (value === null) {
    ref = NULL_SOURCE;
  } else if (value === true) {
    ref = TRUE_SOURCE;
  } else if (value === false) {
    ref = FALSE_SOURCE;
  } else {
    ref = createPrimitiveSource(value);
  }

  stack.push(ref);
});

APPEND_OPCODES.add(Op.Dup, (vm, { op1: register, op2: offset }) => {
  let position = check(vm.fetchValue(register), CheckNumber) - offset;
  vm.stack.dup(position);
});

APPEND_OPCODES.add(Op.Pop, (vm, { op1: count }) => {
  vm.stack.pop(count);
});

APPEND_OPCODES.add(Op.Load, (vm, { op1: register }) => {
  vm.load(register);
});

APPEND_OPCODES.add(Op.Fetch, (vm, { op1: register }) => {
  vm.fetch(register);
});

APPEND_OPCODES.add(Op.BindDynamicScope, (vm, { op1: _names }) => {
  let names = vm[CONSTANTS].getArray<string>(_names);
  vm.bindDynamicScope(names);
});

APPEND_OPCODES.add(Op.Enter, (vm, { op1: args }) => {
  vm.enter(args);
});

APPEND_OPCODES.add(Op.Exit, (vm) => {
  vm.exit();
});

APPEND_OPCODES.add(Op.PushSymbolTable, (vm, { op1: _table }) => {
  let stack = vm.stack;
  stack.push(vm[CONSTANTS].getValue(_table));
});

APPEND_OPCODES.add(Op.PushBlockScope, (vm) => {
  let stack = vm.stack;
  stack.push(vm.scope());
});

APPEND_OPCODES.add(Op.CompileBlock, (vm: InternalVM) => {
  let stack = vm.stack;
  let block = stack.pop<Option<CompilableTemplate> | 0>();

  if (block) {
    stack.push(vm.compile(block));
  } else {
    stack.push(null);
  }
});

APPEND_OPCODES.add(Op.InvokeYield, (vm) => {
  let { stack } = vm;

  let handle = check(stack.pop(), CheckOption(CheckHandle));
  let scope = check(stack.pop(), CheckOption(CheckScope));
  let table = check(stack.pop(), CheckOption(CheckBlockSymbolTable));

  assert(
    table === null || (table && typeof table === 'object' && Array.isArray(table.parameters)),
    stackAssert('Option<BlockSymbolTable>', table)
  );

  let args = check(stack.pop(), CheckInstanceof(VMArgumentsImpl));

  if (table === null) {
    // To balance the pop{Frame,Scope}
    vm.pushFrame();
    vm.pushScope(scope ?? vm.scope());

    return;
  }

  let invokingScope = expect(scope, 'BUG: expected scope');

  // If necessary, create a child scope
  {
    let locals = table.parameters;
    let localsCount = locals.length;

    if (localsCount > 0) {
      invokingScope = invokingScope.child();

      for (let i = 0; i < localsCount; i++) {
        invokingScope.bindSymbol(locals![i], args.at(i));
      }
    }
  }

  vm.pushFrame();
  vm.pushScope(invokingScope);
  vm.call(handle!);
});

APPEND_OPCODES.add(Op.JumpIf, (vm, { op1: target }) => {
  let source = check(vm.stack.pop(), CheckSource);
  let value = Boolean(getValue(source));

  if (isConst(source)) {
    if (value === true) {
      vm.goto(target);
    }
  } else {
    if (value === true) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(source));
  }
});

APPEND_OPCODES.add(Op.JumpUnless, (vm, { op1: target }) => {
  let source = check(vm.stack.pop(), CheckSource);
  let value = Boolean(getValue(source));

  if (isConst(source)) {
    if (value === false) {
      vm.goto(target);
    }
  } else {
    if (value === false) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(source));
  }
});

APPEND_OPCODES.add(Op.JumpEq, (vm, { op1: target, op2: comparison }) => {
  let other = check(vm.stack.peek(), CheckNumber);

  if (other === comparison) {
    vm.goto(target);
  }
});

APPEND_OPCODES.add(Op.AssertSame, (vm) => {
  let source = check(vm.stack.peek(), CheckSource);

  if (isConst(source) === false) {
    vm.updateWith(new Assert(source));
  }
});

APPEND_OPCODES.add(Op.ToBoolean, (vm) => {
  let { stack } = vm;
  let source = check(stack.pop(), CheckSource);

  stack.push(createCache(() => toBool(getValue(source))));
});

export class Assert implements UpdatingOpcode {
  private last: unknown;

  constructor(private source: Source) {
    this.last = getValue(source);
  }

  evaluate(vm: UpdatingVM) {
    let { last, source } = this;
    let current = getValue(source);

    if (last !== current) {
      vm.throw();
    }
  }
}

export class AssertFilter<T, U> implements UpdatingOpcode {
  private last: U;

  constructor(private source: Source<T>, private filter: (from: T) => U) {
    this.last = filter(getValue(source));
  }

  evaluate(vm: UpdatingVM) {
    let { last, source, filter } = this;
    let current = filter(getValue(source));

    if (last !== current) {
      vm.throw();
    }
  }
}
