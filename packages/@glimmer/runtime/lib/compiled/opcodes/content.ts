import {
  check,
  CheckDocumentFragment,
  CheckNode,
  CheckSafeString,
  CheckString,
} from '@glimmer/debug';
import { hasInternalComponentManager, hasInternalHelperManager } from '@glimmer/manager';
import { isConstRef, valueForRef } from '@glimmer/reference';
import { isObject, LOCAL_LOGGER } from '@glimmer/util';
import { CURRIED_COMPONENT, CURRIED_HELPER, CurriedTypes, Op } from '@glimmer/vm';

import { isCurried } from '../../curried-value';
import { isEmpty, isFragment, isNode, isSafeString, shouldCoerce } from '../../dom/normalize';
import { APPEND_OPCODES } from '../../opcodes';
import DynamicTextContent from '../../vm/content/text';
import { CheckReference } from './-debug-strip';
import { AssertFilter } from './vm';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import {
  COMPONENT_CONTENT,
  HELPER_CONTENT,
  type DynamicContentType,
  STRING_CONTENT,
  SAFE_STRING_CONTENT,
  FRAGMENT_CONTENT,
  NODE_CONTENT,
} from '@glimmer/vm/lib/content';

function toContentType(value: unknown) {
  if (shouldCoerce(value)) {
    return STRING_CONTENT;
  } else if (isCurried(value, CURRIED_COMPONENT) || hasInternalComponentManager(value as object)) {
    return COMPONENT_CONTENT;
  } else if (isCurried(value, CURRIED_HELPER) || hasInternalHelperManager(value as object)) {
    return HELPER_CONTENT;
  } else if (isSafeString(value)) {
    return SAFE_STRING_CONTENT;
  } else if (isFragment(value)) {
    return FRAGMENT_CONTENT;
  } else if (isNode(value)) {
    return NODE_CONTENT;
  } else {
    return STRING_CONTENT;
  }
}

function toDynamicContentType(value: unknown): DynamicContentType {
  if (!isObject(value)) {
    return STRING_CONTENT;
  }

  if (isCurried(value, CurriedTypes.Component) || hasInternalComponentManager(value)) {
    return COMPONENT_CONTENT;
  } else {
    if (
      import.meta.env.DEV &&
      !isCurried(value, CurriedTypes.Helper) &&
      !hasInternalHelperManager(value)
    ) {
      if (LOCAL_TRACE_LOGGING) {
        LOCAL_LOGGER.error(
          `Attempted use a dynamic value as a component or helper, but that value did not have an associated component or helper manager. The value was:`,
          value
        );
      }
      throw new Error(
        `Attempted use a dynamic value as a component or helper, but that value did not have an associated component or helper manager.`
      );
    }

    return HELPER_CONTENT;
  }
}

APPEND_OPCODES.add(Op.ContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReference);

  try {
    vm.stack.push(toContentType(valueForRef(reference)));
  } catch (e) {
    vm.unwind(e);
  }

  if (!isConstRef(reference)) {
    vm.updateWith(new AssertFilter(reference, toContentType));
  }
});

APPEND_OPCODES.add(Op.DynamicContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReference);

  vm.stack.push(toDynamicContentType(valueForRef(reference)));

  if (!isConstRef(reference)) {
    vm.updateWith(new AssertFilter(reference, toDynamicContentType));
  }
});

APPEND_OPCODES.add(Op.AppendHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  vm.elements().appendDynamicHTML(value);
});

APPEND_OPCODES.add(Op.AppendSafeHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = check(valueForRef(reference), CheckSafeString).toHTML();
  let value = isEmpty(rawValue) ? '' : check(rawValue, CheckString);

  vm.elements().appendDynamicHTML(value);
});

APPEND_OPCODES.add(Op.AppendText, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let rawValue = valueForRef(reference);
  let value = isEmpty(rawValue) ? '' : String(rawValue);

  let node = vm.elements().appendDynamicText(value);

  if (!isConstRef(reference)) {
    vm.updateWith(new DynamicTextContent(node, reference, value));
  }
});

APPEND_OPCODES.add(Op.AppendDocumentFragment, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckDocumentFragment);

  vm.elements().appendDynamicFragment(value);
});

APPEND_OPCODES.add(Op.AppendNode, (vm) => {
  let reference = check(vm.stack.pop(), CheckReference);

  let value = check(valueForRef(reference), CheckNode);

  vm.elements().appendDynamicNode(value);
});
