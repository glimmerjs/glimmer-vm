import { Op } from '@glimmer/vm';
import { Opaque, Option, BlockSymbolTable } from '@glimmer/interfaces';
import {
  VersionedPathReference,
  CONSTANT_TAG,
  isConst,
  isModified,
  ReferenceCache,
  Revision,
  Reference,
  Tag
} from '@glimmer/reference';
import { initializeGuid } from '@glimmer/util';
import { Handle, Opcode } from '../../environment';
import { LazyConstants } from '../../environment/constants';
import { UpdatingOpcode } from '../../updating-opcodes';
import { Primitive as IPrimitive, PrimitiveReference as PrimitiveKlass, PrimitiveType } from '../../references';
import { CompilableTemplate } from '../../syntax/interfaces';
import { VM, UpdatingVM } from '../../vm';
import { Arguments } from '../../vm/arguments';

export const VM_MAPPINGS = {};

export function Bug() { throw new Error('You compiled an operation that the VM does not know how to handle.'); }

VM_MAPPINGS[Op.Bug] = Bug;

export function Size() { console.log(`Glimmer has ${Op.Size} opcodes.`); }

VM_MAPPINGS[Op.Size] = Size;

export function ChildScope(vm: VM) { vm.pushChildScope(); }

VM_MAPPINGS[Op.ChildScope] = ChildScope;

export function PopScope(vm: VM) { vm.popScope(); }

VM_MAPPINGS[Op.PopScope] = PopScope;

export function PushDynamicScope(vm: VM) { vm.pushDynamicScope(); }

VM_MAPPINGS[Op.PushDynamicScope] = PushDynamicScope;

export function PopDynamicScope(vm: VM) { vm.popDynamicScope(); }

VM_MAPPINGS[Op.PopDynamicScope] = PopDynamicScope;

export function Constant(vm: VM & { constants: LazyConstants }, { op1: other }: Opcode) {
  vm.stack.push(vm.constants.getOther(other));
}

VM_MAPPINGS[Op.Constant] = Constant;

export function Primitive(vm: VM, { op1: primitive }: Opcode) {
  let stack = vm.stack;
  let flag: PrimitiveType = primitive & 7; // 111
  let value = primitive >> 3;

  switch (flag) {
    case PrimitiveType.NUMBER:
      stack.push(value);
      break;
    case PrimitiveType.FLOAT:
      stack.push(vm.constants.getFloat(value));
      break;
    case PrimitiveType.STRING:
      stack.push(vm.constants.getString(value));
      break;
    case PrimitiveType.BOOLEAN_OR_VOID:
      switch (value) {
        case 0: stack.push(false); break;
        case 1: stack.push(true); break;
        case 2: stack.push(null); break;
        case 3: stack.push(undefined); break;
      }
      break;
  }
}

VM_MAPPINGS[Op.Primitive] = Primitive;

export function PrimitiveReference(vm: VM) {
  let stack = vm.stack;
  stack.push(PrimitiveKlass.create(stack.pop<IPrimitive>()));
}

VM_MAPPINGS[Op.PrimitiveReference] = PrimitiveReference;

export function Dup(vm: VM, { op1: register, op2: offset }: Opcode) {
  let position = vm.fetchValue<number>(register) - offset;
  vm.stack.dup(position);
}

VM_MAPPINGS[Op.Dup] = Dup;

export function Pop(vm: VM, { op1: count }: Opcode) { vm.stack.pop(count); }

VM_MAPPINGS[Op.Pop] = Pop;

export function Load(vm: VM, { op1: register }: Opcode) { vm.load(register); }

VM_MAPPINGS[Op.Load] = Load;

export function Fetch(vm: VM, { op1: register }: Opcode) { vm.fetch(register); }

VM_MAPPINGS[Op.Fetch] = Fetch;

export function BindDynamicScope(vm: VM, { op1: _names }: Opcode) {
  let names = vm.constants.getArray(_names);
  vm.bindDynamicScope(names);
}

VM_MAPPINGS[Op.BindDynamicScope] = BindDynamicScope;

export function PushFrame(vm: VM) { vm.pushFrame(); }

VM_MAPPINGS[Op.PushFrame] = PushFrame;

export function PopFrame(vm: VM) { vm.popFrame(); }

VM_MAPPINGS[Op.PopFrame] = PopFrame;

export function Enter(vm: VM, { op1: args }: Opcode) { vm.enter(args); }

VM_MAPPINGS[Op.Enter] = Enter;

export function Exit(vm: VM) { vm.exit(); }

VM_MAPPINGS[Op.Exit] = Exit;

export function CompileBlock(vm: VM) {
  let stack = vm.stack;
  let block = stack.pop<Option<CompilableTemplate> | 0>();
  stack.push(block ? block.compile() : null);
}

VM_MAPPINGS[Op.CompileBlock] = CompileBlock;

export function InvokeStatic(vm: VM) { vm.call(vm.stack.pop<Handle>()); }

VM_MAPPINGS[Op.InvokeStatic] = InvokeStatic;

export function InvokeYield(vm: VM) {
  let { stack } = vm;

  let handle = stack.pop<Option<Handle>>();
  let table = stack.pop<Option<BlockSymbolTable>>();
  let args = stack.pop<Arguments>();

  if (!table) {
    args.clear();

    // To balance the pop{Frame,Scope}
    vm.pushFrame();
    vm.pushCallerScope();

    return;
  }

  let locals = table.parameters;
  let localsCount = locals.length;

  vm.pushCallerScope(localsCount > 0);

  let scope = vm.scope();

  for (let i=0; i<localsCount; i++) {
    scope.bindSymbol(locals![i], args.at(i));
  }

  args.clear();

  vm.pushFrame();
  vm.call(handle!);
}

VM_MAPPINGS[Op.InvokeYield] = InvokeYield;

export function Jump(vm: VM, { op1: target }: Opcode) { vm.goto(target); }

VM_MAPPINGS[Op.Jump] = Jump;

export function JumpIf(vm: VM, { op1: target }: Opcode) {
  let reference = vm.stack.pop<VersionedPathReference<Opaque>>();

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
}

VM_MAPPINGS[Op.JumpIf] = JumpIf;

export function JumpUnless(vm: VM, { op1: target }: Opcode) {
  let reference = vm.stack.pop<VersionedPathReference<Opaque>>();

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
}

VM_MAPPINGS[Op.JumpUnless] = JumpUnless;

export function Return(vm: VM) { vm.return(); }

VM_MAPPINGS[Op.Return] = Return;

export function ReturnTo(vm: VM, { op1: relative }: Opcode) {
  vm.returnTo(relative);
}

VM_MAPPINGS[Op.ReturnTo] = ReturnTo;

export function ToBoolean(vm: VM) {
  let { env, stack } = vm;
  stack.push(env.toConditionalReference(stack.pop<Reference>()));
}

VM_MAPPINGS[Op.ToBoolean] = ToBoolean;

export class Assert extends UpdatingOpcode {
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
  public _guid: number;

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
