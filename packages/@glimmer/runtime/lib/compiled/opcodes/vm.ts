import {
  check,
  CheckBlockSymbolTable,
  CheckHandle,
  CheckInstanceof,
  CheckNumber,
  CheckOption,
  CheckPrimitive,
} from '@glimmer/debug';
import { toBool } from '@glimmer/global-context';
import type { CompilableTemplate, Nullable, UpdatingOpcode, UpdatingVM } from '@glimmer/interfaces';
import {
  createComputeRef,
  createConstRef,
  createPrimitiveRef,
  FALSE_REFERENCE,
  isConstRef,
  NULL_REFERENCE,
  type Reference,
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
  type Revision,
  type Tag,
  validateTag,
  valueForTag,
} from '@glimmer/validator';
import {
  ASSERT_SAME_OP,
  BIND_DYNAMIC_SCOPE_OP,
  CHILD_SCOPE_OP,
  COMPILE_BLOCK_OP,
  CONSTANT_OP,
  CONSTANT_REFERENCE_OP,
  DUP_OP,
  ENTER_OP,
  EXIT_OP,
  FETCH_OP,
  INVOKE_YIELD_OP,
  JUMP_EQ_OP,
  JUMP_IF_OP,
  JUMP_UNLESS_OP,
  LOAD_OP,
  POP_DYNAMIC_SCOPE_OP,
  POP_OP,
  POP_SCOPE_OP,
  PRIMITIVE_OP,
  PRIMITIVE_REFERENCE_OP,
  PUSH_BLOCK_SCOPE_OP,
  PUSH_DYNAMIC_SCOPE_OP,
  PUSH_SYMBOL_TABLE_OP,
  TO_BOOLEAN_OP,
  type MachineRegister,
  type Register,
} from '@glimmer/vm-constants';

import { APPEND_OPCODES } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import type { InternalVM } from '../../vm/append';
import { VMArgumentsImpl } from '../../vm/arguments';
import { CheckReference, CheckScope } from './-debug-strip';
import { stackAssert } from './assert';

APPEND_OPCODES.add(CHILD_SCOPE_OP, (vm) => vm._pushChildScope_());

APPEND_OPCODES.add(POP_SCOPE_OP, (vm) => vm._popScope_());

APPEND_OPCODES.add(PUSH_DYNAMIC_SCOPE_OP, (vm) => vm._pushDynamicScope_());

APPEND_OPCODES.add(POP_DYNAMIC_SCOPE_OP, (vm) => vm._popDynamicScope_());

APPEND_OPCODES.add(CONSTANT_OP, (vm, { op1: other }) => {
  vm.stack.push(vm[CONSTANTS].getValue(decodeHandle(other)));
});

APPEND_OPCODES.add(CONSTANT_REFERENCE_OP, (vm, { op1: other }) => {
  vm.stack.push(createConstRef(vm[CONSTANTS].getValue(decodeHandle(other)), false));
});

APPEND_OPCODES.add(PRIMITIVE_OP, (vm, { op1: primitive }) => {
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

APPEND_OPCODES.add(PRIMITIVE_REFERENCE_OP, (vm) => {
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
    ref = createPrimitiveRef(value);
  }

  stack.push(ref);
});

APPEND_OPCODES.add(DUP_OP, (vm, { op1: register, op2: offset }) => {
  let position = check(vm._fetchValue_(register as Register), CheckNumber) - offset;
  vm.stack.dup(position as MachineRegister);
});

APPEND_OPCODES.add(POP_OP, (vm, { op1: count }) => {
  vm.stack.pop(count);
});

APPEND_OPCODES.add(LOAD_OP, (vm, { op1: register }) => {
  vm._load_(register as Register);
});

APPEND_OPCODES.add(FETCH_OP, (vm, { op1: register }) => {
  vm._fetch_(register as Register);
});

APPEND_OPCODES.add(BIND_DYNAMIC_SCOPE_OP, (vm, { op1: _names }) => {
  let names = vm[CONSTANTS].getArray<string>(_names);
  vm._bindDynamicScope_(names);
});

APPEND_OPCODES.add(ENTER_OP, (vm, { op1: args }) => {
  vm._enter_(args);
});

APPEND_OPCODES.add(EXIT_OP, (vm) => {
  vm._exit_();
});

APPEND_OPCODES.add(PUSH_SYMBOL_TABLE_OP, (vm, { op1: _table }) => {
  let stack = vm.stack;
  stack.push(vm[CONSTANTS].getValue(_table));
});

APPEND_OPCODES.add(PUSH_BLOCK_SCOPE_OP, (vm) => {
  let stack = vm.stack;
  stack.push(vm._scope_());
});

APPEND_OPCODES.add(COMPILE_BLOCK_OP, (vm: InternalVM) => {
  let stack = vm.stack;
  let block = stack.pop<Nullable<CompilableTemplate> | 0>();

  if (block) {
    stack.push(vm._compile_(block));
  } else {
    stack.push(null);
  }
});

APPEND_OPCODES.add(INVOKE_YIELD_OP, (vm) => {
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
    vm._pushFrame_();
    vm._pushScope_(scope ?? vm._scope_());

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

  vm._pushFrame_();
  vm._pushScope_(invokingScope);
  vm._call_(handle!);
});

APPEND_OPCODES.add(JUMP_IF_OP, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReference);
  let value = Boolean(valueForRef(reference));

  if (isConstRef(reference)) {
    if (value === true) {
      vm._goto_(target);
    }
  } else {
    if (value === true) {
      vm._goto_(target);
    }

    vm._updateWith_(new Assert(reference));
  }
});

APPEND_OPCODES.add(JUMP_UNLESS_OP, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReference);
  let value = Boolean(valueForRef(reference));

  if (isConstRef(reference)) {
    if (value === false) {
      vm._goto_(target);
    }
  } else {
    if (value === false) {
      vm._goto_(target);
    }

    vm._updateWith_(new Assert(reference));
  }
});

APPEND_OPCODES.add(JUMP_EQ_OP, (vm, { op1: target, op2: comparison }) => {
  let other = check(vm.stack.peek(), CheckNumber);

  if (other === comparison) {
    vm._goto_(target);
  }
});

APPEND_OPCODES.add(ASSERT_SAME_OP, (vm) => {
  let reference = check(vm.stack.peek(), CheckReference);

  if (isConstRef(reference) === false) {
    vm._updateWith_(new Assert(reference));
  }
});

APPEND_OPCODES.add(TO_BOOLEAN_OP, (vm) => {
  let { stack } = vm;
  let valueRef = check(stack.pop(), CheckReference);

  stack.push(createComputeRef(() => toBool(valueForRef(valueRef))));
});

export class Assert implements UpdatingOpcode {
  #last: unknown;
  #ref: Reference;

  constructor(ref: Reference) {
    this.#ref = ref;
    this.#last = valueForRef(ref);
  }

  evaluate(vm: UpdatingVM) {
    let current = valueForRef(this.#ref);

    if (this.#last !== current) {
      vm.throw();
    }
  }
}

export class AssertFilter<T, U> implements UpdatingOpcode {
  #last: U;
  readonly #ref: Reference<T>;
  readonly #filter: (from: T) => U;

  constructor(ref: Reference<T>, filter: (from: T) => U) {
    this.#ref = ref;
    this.#filter = filter;
    this.#last = filter(valueForRef(ref));
  }

  evaluate(vm: UpdatingVM) {
    let last = this.#last;
    let current = this.#filter(valueForRef(this.#ref));

    if (last !== current) {
      vm.throw();
    }
  }
}

export class JumpIfNotModifiedOpcode implements UpdatingOpcode {
  #tag: Tag = CONSTANT_TAG;
  #lastRevision: Revision = INITIAL;
  #target: number | undefined;

  finalize(tag: Tag, target: number) {
    this.#target = target;
    this.didModify(tag);
  }

  evaluate(vm: UpdatingVM) {
    let tag = this.#tag;
    if (!vm.alwaysRevalidate && validateTag(tag, this.#lastRevision)) {
      consumeTag(tag);
      vm.goto(expect(this.#target, 'VM BUG: Target must be set before attempting to jump'));
    }
  }

  didModify(tag: Tag) {
    this.#tag = tag;
    this.#lastRevision = valueForTag(this.#tag);
    consumeTag(tag);
  }
}

export class BeginTrackFrameOpcode implements UpdatingOpcode {
  readonly #debugLabel: string | undefined;
  constructor(debugLabel?: string) {
    this.#debugLabel = debugLabel;
  }

  evaluate() {
    beginTrackFrame(this.#debugLabel);
  }
}

export class EndTrackFrameOpcode implements UpdatingOpcode {
  readonly #target: JumpIfNotModifiedOpcode;
  constructor(target: JumpIfNotModifiedOpcode) {
    this.#target = target;
  }

  evaluate() {
    let tag = endTrackFrame();
    this.#target.didModify(tag);
  }
}
