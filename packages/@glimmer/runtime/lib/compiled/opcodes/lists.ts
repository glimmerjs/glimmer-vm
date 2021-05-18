import { createIteratorSource } from '@glimmer/reference';
import { getValue } from '@glimmer/validator';
import { APPEND_OPCODES } from '../../opcodes';
import { CheckSource, CheckIterator } from './-debug-strip';
import { check } from '@glimmer/debug';
import { Op } from '@glimmer/interfaces';
import { AssertFilter } from './vm';

APPEND_OPCODES.add(Op.EnterList, (vm, { op1: relativeStart, op2: elseTarget }) => {
  let stack = vm.stack;
  let listSource = check(stack.pop(), CheckSource);
  let keySource = check(stack.pop(), CheckSource);

  let keyValue = getValue(keySource);
  let key = keyValue === null ? '@identity' : String(keyValue);

  let iteratorSource = createIteratorSource(listSource, key);
  let iterator = getValue(iteratorSource);

  vm.updateWith(new AssertFilter(iteratorSource, (iterator) => iterator.isEmpty()));

  if (iterator.isEmpty() === true) {
    // TODO: Fix this offset, should be accurate
    vm.goto(elseTarget + 1);
  } else {
    vm.enterList(iteratorSource, relativeStart);
    vm.stack.push(iterator);
  }
});

APPEND_OPCODES.add(Op.ExitList, (vm) => {
  vm.exitList();
});

APPEND_OPCODES.add(Op.Iterate, (vm, { op1: breaks }) => {
  let stack = vm.stack;
  let iterator = check(stack.peek(), CheckIterator);
  let item = iterator.next();

  if (item !== null) {
    vm.registerItem(vm.enterItem(item));
  } else {
    vm.goto(breaks);
  }
});
