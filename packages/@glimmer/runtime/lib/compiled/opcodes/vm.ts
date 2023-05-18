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

import { define } from '../../opcodes';
import { CONSTANTS } from '../../symbols';
import type { InternalVM } from '../../vm/append';
import { VMArgumentsImpl } from '../../vm/arguments';
import { CheckReference, CheckScope } from './-debug-strip';

define(CHILD_SCOPE_OP, (vm) => vm._pushChildScope_());

define(POP_SCOPE_OP, (vm) => vm._popScope_());

define(PUSH_DYNAMIC_SCOPE_OP, (vm) => vm._pushDynamicScope_());

define(POP_DYNAMIC_SCOPE_OP, (vm) => vm._popDynamicScope_());

define(CONSTANT_OP, (vm, { op1: other }) => {
  vm.stack.push(vm[CONSTANTS].getValue(decodeHandle(other)));
});

define(CONSTANT_REFERENCE_OP, (vm, { op1: other }) => {
  vm.stack.push(createConstRef(vm[CONSTANTS].getValue(decodeHandle(other)), false));
});

define(PRIMITIVE_OP, (vm, { op1: primitive }) => {
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

define(PRIMITIVE_REFERENCE_OP, (vm) => {
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

define(DUP_OP, (vm, { op1: register, op2: offset }) => {
  let position = check(vm._fetchValue_(register as Register), CheckNumber) - offset;
  vm.stack.dup(position as MachineRegister);
});

define(POP_OP, (vm, { op1: count }) => {
  vm.stack.pop(count);
});

define(LOAD_OP, (vm, { op1: register }) => {
  vm._load_(register as Register);
});

define(FETCH_OP, (vm, { op1: register }) => {
  vm._fetch_(register as Register);
});

define(BIND_DYNAMIC_SCOPE_OP, (vm, { op1: _names }) => {
  let names = vm[CONSTANTS].getArray<string>(_names);
  vm._bindDynamicScope_(names);
});

define(ENTER_OP, (vm, { op1: args }) => {
  vm._enter_(args);
});

define(EXIT_OP, (vm) => {
  vm._exit_();
});

define(PUSH_SYMBOL_TABLE_OP, (vm, { op1: _table }) => {
  let stack = vm.stack;
  stack.push(vm[CONSTANTS].getValue(_table));
});

define(PUSH_BLOCK_SCOPE_OP, (vm) => {
  let stack = vm.stack;
  stack.push(vm._scope_());
});

define(COMPILE_BLOCK_OP, (vm: InternalVM) => {
  let stack = vm.stack;
  let block = stack.pop<Nullable<CompilableTemplate> | 0>();

  if (block) {
    stack.push(vm._compile_(block));
  } else {
    stack.push(null);
  }
});

define(INVOKE_YIELD_OP, (vm) => {
  let { stack } = vm;

  let handle = check(stack.pop(), CheckOption(CheckHandle));
  let scope = check(stack.pop(), CheckOption(CheckScope));
  let table = check(stack.pop(), CheckOption(CheckBlockSymbolTable));

  assert(
    table === null || (table && typeof table === 'object' && Array.isArray(table.parameters)),
    `Expected top of stack to be Option<BlockSymbolTable>, was ${String(table)}`
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

// nl.add(65,((t,e)=>{let{op1:n}=e,s=t.stack.pop(),i=O(s);C(s)?i&&t.O(n):(i&&t.O(n),t.M(new al(s)))})),

define(JUMP_IF_OP, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), /* @__PURE__ */ CheckReference);
  let value = valueForRef(reference);

  if (isConstRef(reference)) {
    if (value) vm._goto_(target);
  } else {
    if (value) vm._goto_(target);
    vm._updateWith_(new Assert(reference));
  }
});

define(JUMP_UNLESS_OP, (vm, { op1: target }) => {
  let reference = check(vm.stack.pop(), CheckReference);
  let value = valueForRef(reference);

  if (isConstRef(reference)) {
    if (!value) vm._goto_(target);
  } else {
    if (!value) vm._goto_(target);
    vm._updateWith_(new Assert(reference));
  }
});

define(JUMP_EQ_OP, (vm, { op1: target, op2: comparison }) => {
  let other = check(vm.stack.peek(), CheckNumber);

  if (other === comparison) {
    vm._goto_(target);
  }
});

define(ASSERT_SAME_OP, (vm) => {
  let reference = check(vm.stack.peek(), CheckReference);

  if (isConstRef(reference) === false) {
    vm._updateWith_(new Assert(reference));
  }
});

define(TO_BOOLEAN_OP, (vm) => {
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
