import { Opaque, Option, BlockSymbolTable } from '@glimmer/interfaces';
import { VersionedPathReference, Reference } from '@glimmer/reference';
import { Op } from '@glimmer/vm';
import { Helper, ScopeBlock } from '../../environment';
import { APPEND_OPCODES } from '../../opcodes';
import { FALSE_REFERENCE, TRUE_REFERENCE } from '../../references';
import { PublicVM } from '../../vm';
import { Arguments } from '../../vm/arguments';
import { ConcatReference } from '../expressions/concat';
import { VMHandle } from "@glimmer/opcode-compiler";
import { assert, Check, stackCheck } from "@glimmer/util";

export type FunctionExpression<T> = (vm: PublicVM) => VersionedPathReference<T>;

class BlockSymbolTableCheck extends Check {
  validate(value: any): value is BlockSymbolTable {
    return new NullCheck().validate(value) || this.type(value) === 'object' && Array.isArray(value.parameters);
  }

  throw(value: any) { super.throw(value, 'block symbol table'); }
}

class NullCheck extends Check {
  validate(value: any): value is null {
    return value === null;
  }

  throw(value: any) { super.throw('null', value); }
}

class ReferenceCheck extends Check {
  validate(value: any): value is Reference {
    return value.value !== undefined && typeof value.value === 'function';
  }

  throw(value: any): void {
    super.throw(value, 'reference');
  }
}

class NullableReferenceCheck extends ReferenceCheck {
  validate(value: any): value is Reference {
    return value === null || super.validate(value);
  }
}

class HandleChecker extends Check {
  validate(value: any): value is VMHandle {
    return this.type(value) === 'number' || value.statements !== undefined /* CompilableTemplate */;
  }

  throw(value: any): void {
    super.throw(value, 'handle');
  }
}

const isBlockSymbolTable = new BlockSymbolTableCheck();
const isReference = new ReferenceCheck();
const isHandle = new HandleChecker();
const isNullableReference = new NullableReferenceCheck();

APPEND_OPCODES.add(Op.Helper, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = vm.constants.resolveHandle<Helper>(handle);
  let args = stack.pop<Arguments>();
  let value = helper(vm, args);

  args.clear();

  vm.stack.push(value);
});

APPEND_OPCODES.add(Op.GetVariable, (vm, { op1: symbol }) => {
  let expr = vm.referenceForSymbol(symbol);
  stackCheck(expr, isReference);
  vm.stack.push(expr);
});

APPEND_OPCODES.add(Op.SetVariable, (vm, { op1: symbol }) => {
  let expr = vm.stack.pop<VersionedPathReference<Opaque>>();
  if (stackCheck(expr, isNullableReference)) {
    vm.scope().bindSymbol(symbol, expr);
  }
});

APPEND_OPCODES.add(Op.SetBlock, (vm, { op1: symbol }) => {
  let handle = vm.stack.pop<Option<VMHandle>>();
  let table = vm.stack.pop<Option<BlockSymbolTable>>();

  if (stackCheck(table, isBlockSymbolTable)) {
    let block: Option<ScopeBlock> = table ? [handle!, table] : null;
    vm.scope().bindBlock(symbol, block);
  }
});

APPEND_OPCODES.add(Op.ResolveMaybeLocal, (vm, { op1: _name }) => {
  let name = vm.constants.getString(_name);
  let locals = vm.scope().getPartialMap()!;

  let ref = locals[name];
  if (ref === undefined) {
    ref = vm.getSelf().get(name);
  }

  if (stackCheck(ref, isReference)) {
    vm.stack.push(ref);
  }
});

APPEND_OPCODES.add(Op.RootScope, (vm, { op1: symbols, op2: bindCallerScope }) => {
  vm.pushRootScope(symbols, !!bindCallerScope);
});

APPEND_OPCODES.add(Op.GetProperty, (vm, { op1: _key }) => {
  let key = vm.constants.getString(_key);
  let expr = vm.stack.pop<VersionedPathReference<Opaque>>();
  let ref = expr.get(key);
  stackCheck(ref, isReference);
  vm.stack.push(ref);
});

APPEND_OPCODES.add(Op.GetBlock, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  if (block) {
    stackCheck(block[1], isBlockSymbolTable);
    stack.push(block[1]);
    stackCheck(block[0], isHandle);
    stack.push(block[0]);
  } else {
    stack.push(null);
    stack.push(null);
  }
});

APPEND_OPCODES.add(Op.HasBlock, (vm, { op1: _block }) => {
  let hasBlock = !!vm.scope().getBlock(_block);
  vm.stack.push(hasBlock ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(Op.HasBlockParams, (vm) => {
  vm.stack.pop<VMHandle>();
  let table = vm.stack.pop<Option<BlockSymbolTable>>();

  if (stackCheck(table, isBlockSymbolTable)) {
    let hasBlockParams = table && table.parameters.length;
    vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
  }
});

APPEND_OPCODES.add(Op.Concat, (vm, { op1: count }) => {
  let out: Array<VersionedPathReference<Opaque>> = new Array(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    let ref = vm.stack.pop<VersionedPathReference<Opaque>>();
    if (stackCheck(ref, isReference)) {
      out[offset] = ref;
    }
  }

  vm.stack.push(new ConcatReference(out));
});
