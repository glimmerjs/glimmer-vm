import { check } from '@glimmer/debug';
import { createIteratorRef } from '@glimmer/reference';
import { Op } from '@glimmer/vm';

import { APPEND_OPCODES } from '../../opcodes';
import { CheckIterator, CheckReactive } from './-debug-strip';
import { Assert } from './vm';

APPEND_OPCODES.add(Op.EnterList, (vm, { op1: relativeStart, op2: elseTarget }) => {
  const stack = vm.stack;
  const listRef = check(stack.pop(), CheckReactive);
  const keyRef = check(stack.pop(), CheckReactive);

  vm.deref(keyRef, (keyValue) => {
    const key = keyValue === null ? '@identity' : String(keyValue);

    const iteratorRef = createIteratorRef(listRef, key);

    vm.deref(iteratorRef, (iterator) => {
      const isEmpty = iterator.isEmpty();

      vm.updateWith(Assert.filtered(iteratorRef, isEmpty, (iterator) => iterator.isEmpty()));

      if (isEmpty) {
        vm.goto(elseTarget + 1);
      } else {
        vm.enterList(iteratorRef, relativeStart);
        vm.stack.push(iterator);
      }
    });
  });
});

APPEND_OPCODES.add(Op.ExitList, (vm) => {
  vm.exitList();
});

APPEND_OPCODES.add(Op.Iterate, (vm, { op1: breaks }) => {
  let stack = vm.stack;
  let iterator = check(stack.top(), CheckIterator);
  let item = iterator.next();

  if (item !== null) {
    vm.registerItem(vm.enterItem(item));
  } else {
    vm.goto(breaks);
  }
});
