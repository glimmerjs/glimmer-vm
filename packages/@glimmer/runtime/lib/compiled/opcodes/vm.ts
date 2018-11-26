import { Op } from '@glimmer/vm';
import { CompilableTemplate, Opaque, Option, Recast, VMHandle } from '@glimmer/interfaces';
import {
  CONSTANT_TAG,
  isConst,
  isModified,
  ReferenceCache,
  Revision,
  Tag,
} from '@glimmer/reference';
import { initializeGuid, assert } from '@glimmer/util';
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
import { APPEND_OPCODES, UpdatingOpcode, OpcodeKind } from '../../opcodes';
import { PrimitiveReference } from '../../references';
import { UpdatingVM } from '../../vm';
import { LazyConstants, PrimitiveType } from '@glimmer/program';
import { CheckReference, CheckScope } from './-debug-strip';
import { CONSTANTS } from '../../symbols';

APPEND_OPCODES.add(Op.ChildScope, vm => vm.pushChildScope(), OpcodeKind.Mut);

APPEND_OPCODES.add(Op.PopScope, vm => vm.popScope(), OpcodeKind.Mut);

APPEND_OPCODES.add(Op.PushDynamicScope, vm => vm.pushDynamicScope(), OpcodeKind.Mut);

APPEND_OPCODES.add(Op.PopDynamicScope, vm => vm.popDynamicScope(), OpcodeKind.Mut);

APPEND_OPCODES.add(
  Op.Constant,
  (vm, { op1: other }) => {
    vm.stack.push((vm[CONSTANTS] as LazyConstants).getOther(other));
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Primitive,
  (vm, { op1: primitive }) => {
    let stack = vm.stack;
    let flag = primitive & 7; // 111
    let value = primitive >> 3;

    switch (flag) {
      case PrimitiveType.NUMBER:
        stack.push(value);
        break;
      case PrimitiveType.FLOAT:
        stack.push(vm[CONSTANTS].getNumber(value));
        break;
      case PrimitiveType.STRING:
        stack.push(vm[CONSTANTS].getString(value));
        break;
      case PrimitiveType.BOOLEAN_OR_VOID:
        stack.pushEncodedImmediate(primitive);
        break;
      case PrimitiveType.NEGATIVE:
        stack.push(vm[CONSTANTS].getNumber(value));
        break;
      case PrimitiveType.BIG_NUM:
        stack.push(vm[CONSTANTS].getNumber(value));
        break;
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.PrimitiveReference,
  vm => {
    let stack = vm.stack;
    stack.push(PrimitiveReference.create(check(stack.pop(), CheckPrimitive)));
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.ReifyU32,
  vm => {
    let stack = vm.stack;
    stack.push(check(stack.peek(), CheckReference).value());
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Dup,
  (vm, { op1: register, op2: offset }) => {
    let position = check(vm.fetchValue(register), CheckNumber) - offset;
    vm.stack.dup(position);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Pop,
  (vm, { op1: count }) => {
    vm.stack.popN(count);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Load,
  (vm, { op1: register }) => {
    vm.load(register);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Fetch,
  (vm, { op1: register }) => {
    vm.fetch(register);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.BindDynamicScope,
  (vm, { op1: _names }) => {
    let names = vm[CONSTANTS].getArray(_names);
    vm.bindDynamicScope(names);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Enter,
  (vm, { op1: args }) => {
    vm.enter(args);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.Exit,
  vm => {
    vm.exit();
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.PushSymbolTable,
  (vm, { op1: _table }) => {
    let stack = vm.stack;
    stack.push(vm[CONSTANTS].getSerializable(_table));
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.PushBlockScope,
  vm => {
    let stack = vm.stack;
    stack.push(vm.scope);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.CompileBlock,
  vm => {
    let stack = vm.stack;
    let block = stack.pop<Option<CompilableTemplate> | 0>();

    if (block) {
      stack.pushSmi(block.compile() as Recast<VMHandle, number>);
    } else {
      stack.pushNull();
    }

    check(vm.stack.peek(), CheckOption(CheckNumber));
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.InvokeYield,
  vm => {
    let { stack } = vm;

    let handle = check(stack.pop(), CheckOption(CheckHandle));
    let scope = check(stack.pop(), CheckOption(CheckScope));
    let table = check(stack.pop(), CheckOption(CheckBlockSymbolTable));

    assert(
      table === null || (table && typeof table === 'object' && Array.isArray(table.parameters)),
      stackAssert('Option<BlockSymbolTable>', table)
    );

    let args = check(stack.pop(), CheckInstanceof(ReadonlyArguments));

    if (table === null) {
      // To balance the pop{Frame,Scope}
      vm.pushFrame();
      vm.pushScope(scope!); // Could be null but it doesnt matter as it is immediatelly popped.
      return;
    }

    let invokingScope = scope!;

    // If necessary, create a child scope
    {
      let locals = table.parameters;
      let localsCount = locals.length;

      if (localsCount > 0) {
        let childScope = invokingScope.child();

        for (let i = 0; i < localsCount; i++) {
          childScope.bindSymbol(locals![i], args.at(i));
        }

        invokingScope = childScope;
      }
    }

    vm.pushFrame();
    vm.pushScope(invokingScope);
    vm.call(handle!);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.JumpIf,
  (vm, { op1: target }) => {
    let reference = check(vm.stack.pop(), CheckReference);

    if (isConst(reference)) {
      if (reference.value()) {
        vm.goto(target);
      }
    } else {
      let cache = new ReferenceCache(reference);

      if (cache.peek()) {
        vm.goto(target);
      }

      vm.updateWith(new Assert(cache));
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.JumpUnless,
  (vm, { op1: target }) => {
    let reference = check(vm.stack.pop(), CheckReference);

    if (isConst(reference)) {
      if (!reference.value()) {
        vm.goto(target);
      }
    } else {
      let cache = new ReferenceCache(reference);

      if (!cache.peek()) {
        vm.goto(target);
      }

      vm.updateWith(new Assert(cache));
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.JumpEq,
  (vm, { op1: target, op2: comparison }) => {
    let other = check(vm.stack.peek(), CheckNumber);

    if (other === comparison) {
      vm.goto(target);
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.AssertSame,
  vm => {
    let reference = check(vm.stack.peek(), CheckReference);

    if (!isConst(reference)) {
      vm.updateWith(Assert.initialize(new ReferenceCache(reference)));
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.ToBoolean,
  vm => {
    let { env, stack } = vm;
    stack.push(env.toConditionalReference(check(stack.pop(), CheckReference)));
  },
  OpcodeKind.Mut
);

export class Assert extends UpdatingOpcode {
  static initialize(cache: ReferenceCache<Opaque>): Assert {
    let assert = new Assert(cache);
    cache.peek();
    return assert;
  }

  public type = 'assert';

  public tag: Tag;

  private cache: ReferenceCache<Opaque>;

  constructor(cache: ReferenceCache<Opaque>) {
    super();
    this.tag = cache.tag;
    this.cache = cache;
  }

  evaluate(vm: UpdatingVM) {
    let { cache } = this;

    if (isModified(cache.revalidate())) {
      vm.throw();
    }
  }
}

export class JumpIfNotModifiedOpcode extends UpdatingOpcode {
  public type = 'jump-if-not-modified';

  public tag: Tag;

  private lastRevision: Revision;

  constructor(tag: Tag, private target: LabelOpcode) {
    super();
    this.tag = tag;
    this.lastRevision = tag.value();
  }

  evaluate(vm: UpdatingVM) {
    let { tag, target, lastRevision } = this;

    if (!vm.alwaysRevalidate && tag.validate(lastRevision)) {
      vm.goto(target);
    }
  }

  didModify() {
    this.lastRevision = this.tag.value();
  }
}

export class DidModifyOpcode extends UpdatingOpcode {
  public type = 'did-modify';

  public tag: Tag;

  constructor(private target: JumpIfNotModifiedOpcode) {
    super();
    this.tag = CONSTANT_TAG;
  }

  evaluate() {
    this.target.didModify();
  }
}

export class LabelOpcode implements UpdatingOpcode {
  public tag: Tag = CONSTANT_TAG;
  public type = 'label';
  public label: Option<string> = null;
  public _guid!: number; // Set by initializeGuid() in the constructor

  prev: any = null;
  next: any = null;

  constructor(label: string) {
    initializeGuid(this);
    this.label = label;
  }

  evaluate() {}

  inspect(): string {
    return `${this.label} [${this._guid}]`;
  }
}
