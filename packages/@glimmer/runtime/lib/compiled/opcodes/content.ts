import {
  check,
  CheckDocumentFragment,
  CheckNode,
  CheckSafeString,
  CheckString,
} from '@glimmer/debug';
import { hasInternalComponentManager, hasInternalHelperManager } from '@glimmer/manager';
import { isConstRef, valueForRef } from '@glimmer/reference';
import { isObject } from '@glimmer/util';
import {
  APPEND_DOCUMENT_FRAGMENT_OP,
  APPEND_HTML_OP,
  APPEND_NODE_OP,
  APPEND_SAFE_HTML_OP,
  APPEND_TEXT_OP,
  CONTENT_TYPE_OP,
  DYNAMIC_CONTENT_TYPE_OP,
  CURRIED_COMPONENT,
  CURRIED_HELPER,

  COMPONENT_CONTENT,
  FRAGMENT_CONTENT,
  HELPER_CONTENT,
  NODE_CONTENT,
  SAFE_STRING_CONTENT,
  STRING_CONTENT,
} from '@glimmer/vm-constants';

import { isCurriedType } from '../../curried-value';
import { isEmpty, isFragment, isNode, isSafeString, shouldCoerce } from '../../dom/normalize';
import { APPEND_OPCODES } from '../../opcodes';
import DynamicTextContent from '../../vm/content/text';
import { CheckReference } from './-debug-strip';
import { AssertFilter } from './vm';

function toContentType(value: unknown) {
  if (shouldCoerce(value)) {
    return STRING_CONTENT;
  }

  if (isCurriedType(value, CURRIED_COMPONENT) || hasInternalComponentManager(value as object)) {
    return COMPONENT_CONTENT;
  }

  if (isCurriedType(value, CURRIED_HELPER) || hasInternalHelperManager(value as object)) {
    return HELPER_CONTENT;
  }

  if (isSafeString(value)) {
    return SAFE_STRING_CONTENT;
  }

  if (isNode(value)) {
    return isFragment(value) ? FRAGMENT_CONTENT : NODE_CONTENT;
  }

  return STRING_CONTENT;
}

function toDynamicContentType(value: unknown) {
  if (!isObject(value)) {
    return STRING_CONTENT;
  }

  if (isCurriedType(value, CURRIED_COMPONENT) || hasInternalComponentManager(value)) {
    return COMPONENT_CONTENT;
  } else {
    if (
      import.meta.env.DEV &&
      !isCurriedType(value, CURRIED_HELPER) &&
      !hasInternalHelperManager(value)
    ) {
      throw new Error(
        `Attempted use a dynamic value as a component or helper, but that value did not have an associated component or helper manager. The value was: ${value}`
      );
    }

    return HELPER_CONTENT;
  }
}

APPEND_OPCODES.add(CONTENT_TYPE_OP, (vm) => {
  let reference = check(vm.stack.peek(), CheckReference);

  vm.stack.push(toContentType(valueForRef(reference)));

  if (!isConstRef(reference)) {
    vm._updateWith_(new AssertFilter(reference, toContentType));
  }
});

APPEND_OPCODES.add(DYNAMIC_CONTENT_TYPE_OP, (vm) => {
  let reference = check(vm.stack.peek(), CheckReference);

  vm.stack.push(toDynamicContentType(valueForRef(reference)));

  if (!isConstRef(reference)) {
    vm._updateWith_(new AssertFilter(reference, toDynamicContentType));
  }
});

APPEND_OPCODES.add(APPEND_HTML_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  vm._elements_().appendDynamicHTML(value);
});

APPEND_OPCODES.add(APPEND_SAFE_HTML_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = check(valueForRef(reference), CheckSafeString).toHTML();
  let value = isEmpty(rawValue) ? '' : check(rawValue, CheckString);

  vm._elements_().appendDynamicHTML(value);
});

APPEND_OPCODES.add(APPEND_TEXT_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  let node = vm._elements_().appendDynamicText(value);

  if (!isConstRef(reference)) {
    vm._updateWith_(new DynamicTextContent(node, reference, value));
  }
});

APPEND_OPCODES.add(APPEND_DOCUMENT_FRAGMENT_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckDocumentFragment);

  vm._elements_().appendDynamicFragment(value);
});

APPEND_OPCODES.add(APPEND_NODE_OP, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckNode);

  vm._elements_().appendDynamicNode(value);
});
