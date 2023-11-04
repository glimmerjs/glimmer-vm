import { check } from '@glimmer/debug';
import { createIteratorRef } from '@glimmer/reference';
import { mapResult, Results } from '@glimmer/util';
import { Op } from '@glimmer/vm';

import { APPEND_OPCODES } from '../../opcodes';
import { CheckIterator, CheckReactive } from './-debug-strip';
import { AssertFilter } from './vm';

APPEND_OPCODES.add(Op.EnterList, (vm, { op1: relativeStart, op2: elseTarget }) => {
  const stack = vm.stack;
  const listRef = check(stack.pop(), CheckReactive);
  const keyRef = check(stack.pop(), CheckReactive);

  const keyValue = vm.derefReactive(keyRef);

  if (vm.unwrap(keyValue)) {
    const key = keyValue.value === null ? '@identity' : String(keyValue.value);

    const iteratorRef = createIteratorRef(listRef, key);
    const iterator = vm.derefReactive(iteratorRef);

    const isEmptyResult = mapResult(iterator, (iterator) => iterator.isEmpty());

    // @fixme updating
    vm.updateWith(new AssertFilter(isEmptyResult, iteratorRef, (iterator) => iterator.isEmpty()));

    vm.unwrap(
      mapResult(Results([isEmptyResult, iterator]), ([isEmpty, iterator]) => {
        if (isEmpty) {
          vm.goto(elseTarget + 1);
        } else {
          vm.enterList(iteratorRef, relativeStart);
          vm.stack.push(iterator);
        }
      })
    );
  }
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
