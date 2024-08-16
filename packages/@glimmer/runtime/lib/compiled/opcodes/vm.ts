import type { CompilableTemplate, Nullable, UpdatingOpcode } from '@glimmer/interfaces';
import type { Reference } from '@glimmer/reference';
import type { Revision, Tag } from '@glimmer/validator';
import { toBool } from '@glimmer/global-context';
import {
  createComputeRef,
  createConstRef,
  createPrimitiveRef,
  FALSE_REFERENCE,
  isConstRef,
  NULL_REFERENCE,
  TRUE_REFERENCE,
  UNDEFINED_REFERENCE,
  valueForRef,
} from '@glimmer/reference';
import { assert, decodeHandle, decodeImmediate, expect, isHandle, unwrap } from '@glimmer/util';
import {
  beginTrackFrame,
  CONSTANT_TAG,
  consumeTag,
  endTrackFrame,
  INITIAL,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import { Op } from '@glimmer/vm';

import type { UpdatingVM } from '../../vm';
import type { InternalVM } from '../../vm/append';

import { APPEND_OPCODES } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import { stackAssert } from './assert';

APPEND_OPCODES.add(Op.ChildScope, (vm) => vm.pushChildScope());

APPEND_OPCODES.add(Op.PopScope, (vm) => vm.popScope());

APPEND_OPCODES.add(Op.PushDynamicScope, (vm) => vm.pushDynamicScope());

APPEND_OPCODES.add(Op.PopDynamicScope, (vm) => vm.popDynamicScope());

APPEND_OPCODES.add(Op.Constant, (vm, { op1: other }) => {
  vm.stack.push(vm[CONSTANTS].getValue(decodeHandle(other)));
});

APPEND_OPCODES.add(Op.ConstantReference, (vm, { op1: other }) => {
  vm.stack.push(createConstRef(vm[CONSTANTS].getValue(decodeHandle(other)), false));
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
  let value = stack.pop();
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
    // @ts-expect-error todo
    ref = createPrimitiveRef(value);
  }

  stack.push(ref);
});

APPEND_OPCODES.add(Op.Dup, (vm, { op1: register, op2: offset }) => {
  let position = vm.fetchValue(register) - offset;
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
  let block = stack.pop<Nullable<CompilableTemplate> | 0>();

  if (block) {
    stack.push(vm.compile(block));
  } else {
    stack.push(null);
  }
});

APPEND_OPCODES.add(Op.InvokeYield, (vm) => {
  let { stack } = vm;

  let handle = stack.pop();
  let scope = stack.pop();
  let table = stack.pop();

  assert(
    // @ts-expect-error todo
    table === null || (table && typeof table === 'object' && Array.isArray(table.parameters)),
    stackAssert('Option<BlockSymbolTable>', table)
  );

  let args = stack.pop();

  if (table === null) {
    // To balance the pop{Frame,Scope}
    vm.pushFrame();
    // @ts-expect-error todo
    vm.pushScope(scope ?? vm.scope());

    return;
  }

  let invokingScope = expect(scope, 'BUG: expected scope');

  // If necessary, create a child scope
  {
    // @ts-expect-error todo
    let locals = table.parameters;
    let localsCount = locals.length;

    if (localsCount > 0) {
      // @ts-expect-error todo
      invokingScope = invokingScope.child();

      for (let i = 0; i < localsCount; i++) {
        // @ts-expect-error todo
        invokingScope.bindSymbol(unwrap(locals[i]), args.at(i));
      }
    }
  }

  vm.pushFrame();
  // @ts-expect-error todo
  vm.pushScope(invokingScope);
  // @ts-expect-error todo
  vm.call(handle);
});

APPEND_OPCODES.add(Op.JumpIf, (vm, { op1: target }) => {
  let reference = vm.stack.pop();
  // @ts-expect-error todo
  let value = Boolean(valueForRef(reference));

  // @ts-expect-error todo
  if (isConstRef(reference)) {
    if (value === true) {
      vm.goto(target);
    }
  } else {
    if (value === true) {
      vm.goto(target);
    }

    // @ts-expect-error todo
    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.JumpUnless, (vm, { op1: target }) => {
  let reference = vm.stack.pop();
  // @ts-expect-error todo
  let value = Boolean(valueForRef(reference));

  // @ts-expect-error todo
  if (isConstRef(reference)) {
    if (value === false) {
      vm.goto(target);
    }
  } else {
    if (value === false) {
      vm.goto(target);
    }

    // @ts-expect-error todo
    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.JumpEq, (vm, { op1: target, op2: comparison }) => {
  let other = vm.stack.peek();

  if (other === comparison) {
    vm.goto(target);
  }
});

APPEND_OPCODES.add(Op.AssertSame, (vm) => {
  let reference = vm.stack.peek();

  // @ts-expect-error todo
  if (isConstRef(reference) === false) {
    // @ts-expect-error todo
    vm.updateWith(new Assert(reference));
  }
});

APPEND_OPCODES.add(Op.ToBoolean, (vm) => {
  let { stack } = vm;
  let valueRef = stack.pop();

  // @ts-expect-error todo
  stack.push(createComputeRef(() => toBool(valueForRef(valueRef))));
});

export class Assert implements UpdatingOpcode {
  private last: unknown;

  constructor(private ref: Reference) {
    this.last = valueForRef(ref);
  }

  evaluate(vm: UpdatingVM) {
    let { last, ref } = this;
    let current = valueForRef(ref);

    if (last !== current) {
      vm.throw();
    }
  }
}

export class AssertFilter<T, U> implements UpdatingOpcode {
  private last: U;

  constructor(
    private ref: Reference<T>,
    private filter: (from: T) => U
  ) {
    this.last = filter(valueForRef(ref));
  }

  evaluate(vm: UpdatingVM) {
    let { last, ref, filter } = this;
    let current = filter(valueForRef(ref));

    if (last !== current) {
      vm.throw();
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
