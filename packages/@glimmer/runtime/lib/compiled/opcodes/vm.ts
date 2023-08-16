import type {
  CompilableTemplate,
  Description,
  DevMode,
  ErrorHandler,
  Nullable,
  Optional,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import type { Reactive } from '@glimmer/reference';
import type { Revision, Tag } from '@glimmer/validator';
import {
  check,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckNullable,
  CheckNumber,
  CheckPrimitive,
  CheckSyscallRegister,
} from '@glimmer/debug';
import { toBool } from '@glimmer/global-context';
import {
  createPrimitiveCell,
  FALSE_REFERENCE,
  MutableCell,
  NULL_REFERENCE,
  ReadonlyCell,
  readReactive,
  ResultFormula,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
} from '@glimmer/reference';
import {
  assert,
  decodeBoolean,
  decodeHandle,
  decodeImmediate,
  expect,
  getDescription,
  isHandle,
  mapResult,
  unwrap,
} from '@glimmer/util';
import {
  beginTrackFrame,
  CONSTANT_TAG,
  consumeTag,
  endTrackFrame,
  INITIAL,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import { $sp, Op } from '@glimmer/vm';

import type { UpdatingVM } from '../../vm';
import type { InternalVM } from '../../vm/append';

import { APPEND_OPCODES } from '../../opcodes';
import { CheckArguments, CheckReactive, CheckScope } from './-debug-strip';
import { stackAssert } from './assert';

APPEND_OPCODES.add(Op.PushBegin, (vm, { op1: relativePc }) => {
  const reactiveHandler = check(vm.stack.pop(), CheckNullable(CheckReactive));

  const error = MutableCell(1, 'error boundary');
  vm.stack.push(error);

  if (reactiveHandler) {
    vm.deref(reactiveHandler, (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw vm.earlyError('Expected try handler %r to be a function', reactiveHandler);
      }

      vm.setupBegin(vm.target(relativePc), error, handler as ErrorHandler);
    });
  } else {
    vm.setupBegin(vm.target(relativePc), error, null);
  }
});

APPEND_OPCODES.add(Op.Begin, (vm) => {
  vm.begin();
});

APPEND_OPCODES.add(Op.Finally, (vm) => {
  vm.finally();
});

APPEND_OPCODES.add(Op.ChildScope, (vm) => vm.pushChildScope());

APPEND_OPCODES.add(Op.PopScope, (vm) => vm.popScope());

APPEND_OPCODES.add(Op.PushDynamicScope, (vm) => vm.pushDynamicScope());

APPEND_OPCODES.add(Op.PopDynamicScope, (vm) => vm.popDynamicScope());

APPEND_OPCODES.add(Op.Constant, (vm, { op1: other }) => {
  vm.stack.push(vm.constants.getValue(decodeHandle(other)));
});

APPEND_OPCODES.add(Op.ConstantReference, (vm, { op1: other }) => {
  vm.stack.push(ReadonlyCell(vm.constants.getValue(decodeHandle(other)), false));
});

APPEND_OPCODES.add(Op.Primitive, (vm, { op1: primitive }) => {
  let stack = vm.stack;

  if (isHandle(primitive)) {
    // it is a handle which does not already exist on the stack
    let value = vm.constants.getValue(decodeHandle(primitive));
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
    ref = UNDEFINED_REFERENCE;
  } else if (value === null) {
    ref = NULL_REFERENCE;
  } else if (value === true) {
    ref = TRUE_REFERENCE;
  } else if (value === false) {
    ref = FALSE_REFERENCE;
  } else {
    ref = createPrimitiveCell(value);
  }

  stack.push(ref);
});

APPEND_OPCODES.add(Op.InvokeStatic, (vm, { op1: handle }) => vm.call(handle));
APPEND_OPCODES.add(Op.InvokeVirtual, (vm) => vm.call(vm.stack.pop()));
APPEND_OPCODES.add(Op.Start, (vm) => vm.start());
APPEND_OPCODES.add(Op.Return, (vm) => vm.return());

APPEND_OPCODES.add(Op.Dup, (vm, { op1: register, op2: offset }) => {
  let position = check(register === $sp ? vm.sp : vm.fp, CheckNumber) - offset;
  vm.stack.dup(position);
});

APPEND_OPCODES.add(Op.Pop, (vm, { op1: count }) => {
  vm.stack.pop(count);
});

APPEND_OPCODES.add(Op.Load, (vm, { op1: register }) => {
  vm.load(check(register, CheckSyscallRegister));
});

APPEND_OPCODES.add(Op.Fetch, (vm, { op1: register }) => {
  vm.fetch(check(register, CheckSyscallRegister));
});

APPEND_OPCODES.add(Op.BindDynamicScope, (vm, { op1: _names }) => {
  let names = vm.constants.getArray<string[]>(_names);
  vm.bindDynamicScope(names);
});

APPEND_OPCODES.add(Op.Enter, (vm, { op1: args, op2: begin }) => {
  vm.enter(args, decodeBoolean(begin));
});

APPEND_OPCODES.add(Op.Exit, (vm) => {
  vm.exit();
});

APPEND_OPCODES.add(Op.PushSymbolTable, (vm, { op1: _table }) => {
  let stack = vm.stack;
  stack.push(vm.constants.getValue(_table));
});

APPEND_OPCODES.add(Op.PushBlockScope, (vm) => {
  let stack = vm.stack;
  stack.push(vm.scope);
});

APPEND_OPCODES.add(Op.CompileBlock, (vm: InternalVM) => {
  let stack = vm.stack;
  let block = stack.pop<Nullable<CompilableTemplate> | 0>();

  if (block) {
    stack.push(vm.compile(block));
  } else {
    stack.push(null);
  }
});

APPEND_OPCODES.add(Op.InvokeYield, (vm) => {
  let { stack } = vm;

  // pop 3
  let handle = check(stack.pop(), CheckNullable(CheckHandle));
  let scope = check(stack.pop(), CheckNullable(CheckScope));
  let table = check(stack.pop(), CheckNullable(CheckBlockSymbolTable));

  assert(
    table === null || (table && typeof table === 'object' && Array.isArray(table.parameters)),
    stackAssert('Option<BlockSymbolTable>', table)
  );

  // pop 1
  const args = check(vm.stack.pop(), CheckArguments);

  // To balance the pop{Frame,Scope}
  if (table === null) {
    // push 2
    vm.pushFrame();
    // push 0
    vm.pushScope(scope ?? vm.scope);

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
        invokingScope.bindSymbol(unwrap(locals[i]), args.at(i));
      }
    }
  }

  // push 2
  vm.pushFrame();
  // push 0
  vm.pushScope(invokingScope);
  vm.call(handle);
});

APPEND_OPCODES.add(Op.JumpIf, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    if (value === true) vm.goto(target);

    return () => Assert.of(reference, value);
  });
});

APPEND_OPCODES.add(Op.JumpUnless, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    if (!value) vm.goto(target);

    return () => Assert.of(reference, value);
  });
});

APPEND_OPCODES.add(Op.JumpEq, (vm, { op1: target, op2: comparison }) => {
  let other = check(vm.stack.top(), CheckNumber);

  if (other === comparison) {
    vm.goto(target);
  }
});

APPEND_OPCODES.add(Op.AssertSame, (vm) => {
  let reference = check(vm.stack.top(), CheckReactive);

  vm.deref(reference, (value) => {
    return () => Assert.of(reference, value);
  });
});

APPEND_OPCODES.add(Op.ToBoolean, (vm) => {
  let { stack } = vm;
  let valueRef = check(stack.pop(), CheckReactive);

  stack.push(ResultFormula(() => mapResult(readReactive(valueRef), toBool)));
});

export class Assert<T, U> implements UpdatingOpcode {
  static of<T>(reactive: Reactive<T>, value: T) {
    return new Assert(reactive, value);
  }

  static filtered<T, U>(reactive: Reactive<T>, value: U, filter: (from: T) => U) {
    return new Assert(reactive, value, filter);
  }

  readonly #reactive: Reactive<T>;
  readonly #filter?: Optional<(from: T) => U>;

  #last: U;

  private constructor(reactive: Reactive<T>, value: U, filter?: (from: T) => U) {
    this.#reactive = reactive;
    this.#filter = filter;
    this.#last = value;
  }

  evaluate(vm: UpdatingVM) {
    vm.deref(this.#reactive, (value) => {
      const currentValue = this.#filter ? this.#filter(value) : (value as unknown as U);

      if (this.#last !== currentValue) {
        vm.reset();
      }

      this.#last = currentValue;
    });
  }
}

export class JumpIfNotModifiedOpcode implements UpdatingOpcode {
  private tag: Tag = CONSTANT_TAG;
  private lastRevision: Revision = INITIAL;
  private target?: number;

  finalize(tag: Tag, target: number) {
    this.target = target;
    this.didModify(tag);
  }

  evaluate(vm: UpdatingVM) {
    let { tag, target, lastRevision } = this;

    if (!vm.alwaysRevalidate && validateTag(tag, lastRevision)) {
      consumeTag(tag);
      vm.goto(expect(target, 'VM BUG: Target must be set before attempting to jump'));
    }
  }

  didModify(tag: Tag) {
    this.tag = tag;
    this.lastRevision = valueForTag(this.tag);
    consumeTag(tag);
  }
}

export class BeginTrackFrameOpcode implements UpdatingOpcode {
  declare description: DevMode<Description>;

  constructor() {}

  evaluate() {
    beginTrackFrame(getDescription(this));
  }
}

export class EndTrackFrameOpcode implements UpdatingOpcode {
  constructor(private target: JumpIfNotModifiedOpcode) {}

  evaluate() {
    let tag = endTrackFrame();
    this.target.didModify(tag);
  }
}
