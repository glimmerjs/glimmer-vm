import { check } from '@glimmer/debug';
import { createIteratorRef, valueForRef } from '@glimmer/reference';

import { define } from '../../opcodes';
import { CheckIterator, CheckReference } from './-debug-strip';
import { AssertFilter } from './vm';
import { ENTER_LIST_OP, EXIT_LIST_OP, ITERATE_OP } from '@glimmer/vm-constants';

define(ENTER_LIST_OP, (vm, { op1: relativeStart, op2: elseTarget }) => {
  let stack = vm.stack;
  let listReference = check(stack.pop(), CheckReference);
  let keyReference = check(stack.pop(), CheckReference);

  let keyValue = valueForRef(keyReference);
  let key = keyValue === null ? '@identity' : String(keyValue);

  let iteratorReference = createIteratorRef(listReference, key);
  let iterator = valueForRef(iteratorReference);

  vm._updateWith_(new AssertFilter(iteratorReference, (iterator) => iterator._isEmpty_()));

  if (iterator._isEmpty_() === true) {
    // TODO: Fix this offset, should be accurate
    vm._goto_(elseTarget + 1);
  } else {
    vm._enterList_(iteratorReference, relativeStart);
    vm.stack.push(iterator);
  }
});

define(EXIT_LIST_OP, (vm) => {
  vm._exitList_();
});

define(ITERATE_OP, (vm, { op1: breaks }) => {
  let stack = vm.stack;
  let iterator = check(stack.peek(), CheckIterator);
  let item = iterator._next_();

  if (item === null) {
    vm._goto_(breaks);
  } else {
    vm._registerItem_(vm._enterItem_(item));
  }
});
