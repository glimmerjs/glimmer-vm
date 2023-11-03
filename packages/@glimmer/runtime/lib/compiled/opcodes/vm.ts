import {
  check,
  CheckBlockSymbolTable,
  type Checker,
  CheckFunction,
  CheckHandle,
  CheckNullable,
  CheckNumber,
  CheckPrimitive,
  CheckSyscallRegister,
} from '@glimmer/debug';
import { toBool } from '@glimmer/global-context';
import type {
  CompilableTemplate,
  ErrorHandler,
  Nullable,
  Result,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import {
  createPrimitiveCell,
  FallibleFormula,
  FALSE_REFERENCE,
  isConstant,
  NULL_REFERENCE,
  ReadonlyCell,
  readReactive,
  type SomeReactive,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  unwrapReactive,
} from '@glimmer/reference';
import {
  assert,
  decodeHandle,
  decodeImmediate,
  expect,
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
  type Revision,
  type Tag,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import { $sp, Op } from '@glimmer/vm';

import { APPEND_OPCODES } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import type { UpdatingVM } from '../../vm';
import type { InternalVM } from '../../vm/append';
import { CheckArguments, CheckReactive, CheckScope } from './-debug-strip';
import { stackAssert } from './assert';

APPEND_OPCODES.add(Op.PushTryFrame, (vm, { op1: catchPc }) => {
  const handler = check(vm.stack.pop(), CheckNullable(CheckReactive));

  if (handler === null) {
    vm.pushTryFrame(catchPc, null);
  } else {
    const result = vm.deref(handler);

    // if the handler itself throws an error, propagate the error up to the next frame (and possibly
    // the top level)
    if (vm.unwrap(result)) {
      vm.pushTryFrame(
        catchPc,
        check(result.value, CheckNullable(CheckFunction as Checker<ErrorHandler>))
      );
    }
  }
});

APPEND_OPCODES.add(Op.PopTryFrame, (vm) => {
  vm.popTryFrame();
});

APPEND_OPCODES.add(Op.ChildScope, (vm) => vm.pushChildScope());

APPEND_OPCODES.add(Op.PopScope, (vm) => vm.popScope());

APPEND_OPCODES.add(Op.PushDynamicScope, (vm) => vm.pushDynamicScope());

APPEND_OPCODES.add(Op.PopDynamicScope, (vm) => vm.popDynamicScope());

APPEND_OPCODES.add(Op.Constant, (vm, { op1: other }) => {
  vm.stack.push(vm[CONSTANTS].getValue(decodeHandle(other)));
});

APPEND_OPCODES.add(Op.ConstantReference, (vm, { op1: other }) => {
  vm.stack.push(ReadonlyCell(vm[CONSTANTS].getValue(decodeHandle(other)), false));
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
  let names = vm[CONSTANTS].getArray<string[]>(_names);
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
  let value = Boolean(unwrapReactive(reference));

  if (isConstant(reference)) {
    if (value === true) {
      vm.goto(target);
    }
  } else {
    if (value === true) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.JumpUnless, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReactive);
  let value = Boolean(unwrapReactive(reference));

  if (isConstant(reference)) {
    if (value === false) {
      vm.goto(target);
    }
  } else {
    if (value === false) {
      vm.goto(target);
    }

    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.JumpEq, (vm, { op1: target, op2: comparison }) => {
  let other = check(vm.stack.top(), CheckNumber);

  if (other === comparison) {
    vm.goto(target);
  }
});

APPEND_OPCODES.add(Op.AssertSame, (vm) => {
  let reference = check(vm.stack.top(), CheckReactive);

  if (isConstant(reference) === false) {
    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.ToBoolean, (vm) => {
  let { stack } = vm;
  let valueRef = check(stack.pop(), CheckReactive);

  stack.push(FallibleFormula(() => toBool(unwrapReactive(valueRef))));
});

export class Assert implements UpdatingOpcode {
  private last: unknown;

  constructor(private ref: SomeReactive) {
    this.last = unwrapReactive(ref);
  }

  evaluate(vm: UpdatingVM) {
    let { last, ref } = this;
    let current = unwrapReactive(ref);

    if (last !== current) {
      vm.throw();
    }
  }
}

export class AssertFilter<T, U> implements UpdatingOpcode {
  #last: Result<U>;
  readonly #ref: SomeReactive<T>;
  /**
   * @fixme fallible filters
   */
  readonly #filter: (from: T) => U;

  constructor(current: Result<U>, ref: SomeReactive<T>, filter: (from: T) => U) {
    this.#last = current;
    this.#ref = ref;
    this.#filter = filter;
  }

  evaluate(vm: UpdatingVM) {
    const result = readReactive(this.#ref);

    if (result.type === 'err') {
      this.#last = { type: 'err', value: result.value };
      vm.throw();
    } else {
      const update = mapResult(result, (value) => this.#filter(value));
      if (this.#last.type !== update.type) {
        vm.throw();
      }

      if (this.#last.type === 'ok' && this.#last.value !== update.value) {
        vm.throw();
      }

      this.#last = update;
    }
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
  constructor(private debugLabel?: string) {}

  evaluate() {
    beginTrackFrame(this.debugLabel);
  }
}

export class EndTrackFrameOpcode implements UpdatingOpcode {
  constructor(private target: JumpIfNotModifiedOpcode) {}

  evaluate() {
    let tag = endTrackFrame();
    this.target.didModify(tag);
  }
}
