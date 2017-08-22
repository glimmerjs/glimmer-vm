import { Opaque, Option, BlockSymbolTable } from '@glimmer/interfaces';
import { VersionedPathReference } from '@glimmer/reference';
import { Op } from '@glimmer/vm';
import { Helper as IHelper, Handle, ScopeBlock, Opcode } from '../../environment';
import { FALSE_REFERENCE, TRUE_REFERENCE } from '../../references';
import { PublicVM, VM } from '../../vm';
import { Arguments } from '../../vm/arguments';
import { ConcatReference } from '../expressions/concat';

export type FunctionExpression<T> = (vm: PublicVM) => VersionedPathReference<T>;

export const EXPRESSION_MAPPINGS = {};

export function Helper(vm: VM, { op1: specifier }: Opcode) {
  let stack = vm.stack;
  let helper = vm.constants.resolveSpecifier<IHelper>(specifier);
  let args = stack.pop<Arguments>();
  let value = helper(vm, args);

  args.clear();

  vm.stack.push(value);
}

EXPRESSION_MAPPINGS[Op.Helper] = Helper;

export function GetVariable(vm: VM, { op1: symbol }: Opcode) {
  let expr = vm.referenceForSymbol(symbol);
  vm.stack.push(expr);
}

EXPRESSION_MAPPINGS[Op.GetVariable] = GetVariable;

export function SetVariable(vm: VM, { op1: symbol }: Opcode) {
  let expr = vm.stack.pop<VersionedPathReference<Opaque>>();
  vm.scope().bindSymbol(symbol, expr);
}

EXPRESSION_MAPPINGS[Op.SetVariable] = SetVariable;

export function SetBlock(vm: VM, { op1: symbol }: Opcode) {
  let handle = vm.stack.pop<Option<Handle>>();
  let table = vm.stack.pop<Option<BlockSymbolTable>>();
  let block: Option<ScopeBlock> = table ? [handle!, table] : null;

  vm.scope().bindBlock(symbol, block);
}

EXPRESSION_MAPPINGS[Op.SetBlock] = SetBlock;

export function ResolveMaybeLocal(vm: VM, { op1: _name }: Opcode) {
  let name = vm.constants.getString(_name);
  let locals = vm.scope().getPartialMap()!;

  let ref = locals[name];
  if (ref === undefined) {
    ref = vm.getSelf().get(name);
  }

  vm.stack.push(ref);
}

EXPRESSION_MAPPINGS[Op.ResolveMaybeLocal] = ResolveMaybeLocal;

export function RootScope(vm: VM, { op1: symbols, op2: bindCallerScope }: Opcode) {
  vm.pushRootScope(symbols, !!bindCallerScope);
}

EXPRESSION_MAPPINGS[Op.RootScope] = RootScope;

export function GetProperty(vm: VM, { op1: _key }: Opcode) {
  let key = vm.constants.getString(_key);
  let expr = vm.stack.pop<VersionedPathReference<Opaque>>();
  vm.stack.push(expr.get(key));
}

EXPRESSION_MAPPINGS[Op.GetProperty] = GetProperty;

export function GetBlock(vm: VM, { op1: _block }: Opcode) {
  let { stack } = vm;
  let block = vm.scope().getBlock(_block);

  if (block) {
    stack.push(block[1]);
    stack.push(block[0]);
  } else {
    stack.push(null);
    stack.push(null);
  }
}

EXPRESSION_MAPPINGS[Op.GetBlock] = GetBlock;

export function HasBlock(vm: VM, { op1: _block }: Opcode) {
  let hasBlock = !!vm.scope().getBlock(_block);
  vm.stack.push(hasBlock ? TRUE_REFERENCE : FALSE_REFERENCE);
}

EXPRESSION_MAPPINGS[Op.HasBlock] = HasBlock;

export function HasBlockParams(vm: VM, { op1: _block }: Opcode) {
  let block = vm.scope().getBlock(_block);
  let hasBlockParams = block && block[1].parameters.length;
  vm.stack.push(hasBlockParams ? TRUE_REFERENCE : FALSE_REFERENCE);
}

EXPRESSION_MAPPINGS[Op.HasBlockParams] = HasBlockParams;

export function Concat(vm: VM, { op1: count }: Opcode) {
  let out: Array<VersionedPathReference<Opaque>> = new Array(count);

  for (let i = count; i > 0; i--) {
    let offset = i - 1;
    out[offset] = vm.stack.pop<VersionedPathReference<Opaque>>();
  }

  vm.stack.push(new ConcatReference(out));
}

EXPRESSION_MAPPINGS[Op.Concat] = Concat;
