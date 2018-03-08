import { Opaque, Option } from '@glimmer/interfaces';
import { VersionedPathReference } from '@glimmer/reference';
import { Op, Register } from '@glimmer/vm';
import { ScopeBlock, ProxyStackScope } from '../../environment';
import { APPEND_OPCODES } from '../../opcodes';
import { FALSE_REFERENCE, TRUE_REFERENCE } from '../../references';
import { PublicVM } from '../../vm';
import { ConcatReference } from '../expressions/concat';
import { check, CheckFunction, CheckOption, CheckHandle, CheckBlockSymbolTable, CheckOr } from '@glimmer/debug';
import { CheckArguments, CheckPathReference, CheckCompilableBlock, CheckScope } from './-debug-strip';

export type FunctionExpression<T> = (vm: PublicVM) => VersionedPathReference<T>;

APPEND_OPCODES.add(Op.Helper, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.resolveHandle(handle), CheckFunction);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(vm, args);

  vm.loadValue(Register.v0, value);
});

APPEND_OPCODES.add(Op.GetVariable, (vm, { op1: symbol }) => {
  let expr = vm.referenceForSymbol(symbol);
  vm.stack.push(expr);
});

APPEND_OPCODES.add(Op.SetVariable, (vm, { op1: symbol }) => {
  let expr = check(vm.stack.pop(), CheckPathReference);
  vm.scope().bindSymbol(symbol, expr);
});

APPEND_OPCODES.add(Op.SetBlock, (vm, { op1: symbol }) => {
  let block = vm.stack.pop();

  if (block !== null) {
    check(block[0], CheckOr(CheckOption(CheckHandle), CheckCompilableBlock));
    check(block[1], CheckScope);
    check(block[2], CheckOption(CheckBlockSymbolTable));
  }

  vm.scope().bindBlock(symbol, block as Option<ScopeBlock>);
});

APPEND_OPCODES.add(Op.ProxyStackScope, vm => {
  let { stack } = vm;

  // Don't include the saved off $ra and $fp
  vm.pushScope(new ProxyStackScope(stack, stack.fp + 2, stack.sp));
});

APPEND_OPCODES.add(Op.ResolveMaybeLocal, (vm, { op1: _name }) => {
  let name = vm.constants.getString(_name);
  let locals = vm.scope().getPartialMap()!;

  let ref = locals[name];
  if (ref === undefined) {
    ref = vm.getSelf().get(name);
  }

  vm.stack.push(ref);
});

APPEND_OPCODES.add(Op.GetProperty, (vm, { op1: _key }) => {
  let key = vm.constants.getString(_key);
  let expr = check(vm.stack.pop(), CheckPathReference);
  vm.stack.push(expr.get(key));
});

APPEND_OPCODES.add(Op.GetBlock, (vm, { op1: _block }) => {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  stack.push(block);
});

APPEND_OPCODES.add(Op.HasBlock, (vm, { op1: _block }) => {
  let hasBlock = !!vm.scope().getBlock(_block);
  vm.stack.push(hasBlock ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(Op.HasBlockParams, (vm) => {
  let block = vm.stack.pop();

  if (block !== null) {
    check(block[0], CheckOr(CheckOption(CheckHandle), CheckCompilableBlock));
    check(block[1], CheckScope);
    check(block[2], CheckOption(CheckBlockSymbolTable));
  }

  let hasBlockParams = block && block[2] && block[2].parameters.length;
  vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
});

APPEND_OPCODES.add(Op.Concat, (vm, { op1: count }) => {
  let out: Array<VersionedPathReference<Opaque>> = new Array(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    out[offset] = check(vm.stack.pop(), CheckPathReference);
  }

  vm.stack.push(new ConcatReference(out));
});
