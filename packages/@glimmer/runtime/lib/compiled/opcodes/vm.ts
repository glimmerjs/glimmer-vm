import type {
  CompilableTemplate,
  Description,
  DevMode,
  ErrorHandler,
  Nullable,
  ReactiveResult,
  Result,
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
  Formula,
  isConstant,
  MutableCell,
  NULL_REFERENCE,
  ReadonlyCell,
  readReactive,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  unwrapReactive,
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

  stack.push(Formula(() => toBool(unwrapReactive(valueRef))));
});

export class Assert implements UpdatingOpcode {
  readonly #reactive: Reactive;
  #last: ReactiveResult<unknown>;

  constructor(reactive: Reactive) {
    this.#last = readReactive(reactive);
    this.#reactive = reactive;
  }

  evaluate(vm: UpdatingVM) {
    const current = readReactive(this.#reactive);
    const last = this.#last;

    switch (current.type) {
      case 'err': {
        if (last.type !== 'err' || last.value !== current.value) {
          vm.unwind();
        }
        break;
      }

      case 'ok': {
        if (last.type !== 'ok' || last.value !== current.value) {
          vm.throw();
        }
        break;
      }
    }

    this.#last = current;
  }
}

export class AssertFilter<T, U> implements UpdatingOpcode {
  #last: Result<U>;
  readonly #ref: Reactive<T>;
  /**
   * @fixme fallible filters
   */
  readonly #filter: (from: T) => U;

  constructor(current: Result<U>, ref: Reactive<T>, filter: (from: T) => U) {
    this.#last = current;
    this.#ref = ref;
    this.#filter = filter;
  }

  evaluate(vm: UpdatingVM) {
    const result = readReactive(this.#ref);

    if (result.type === 'err') {
      this.#last = { type: 'err', value: result.value };
      vm.unwind();
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
