import {
  check,
  CheckDocumentFragment,
  CheckNode,
  CheckSafeString,
  CheckString,
} from '@glimmer/debug';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { hasInternalComponentManager, hasInternalHelperManager } from '@glimmer/manager';
import { isConstant } from '@glimmer/reference';
import { isObject , LOCAL_LOGGER } from '@glimmer/util';
import { CURRIED_COMPONENT, CURRIED_HELPER, CurriedTypes, Op } from '@glimmer/vm';
import {
  COMPONENT_CONTENT,
  type DynamicContentType,
  FRAGMENT_CONTENT,
  HELPER_CONTENT,
  NODE_CONTENT,
  SAFE_STRING_CONTENT,
  STRING_CONTENT,
} from '@glimmer/vm/lib/content';

import { isCurried } from '../../curried-value';
import { isEmpty, isFragment, isNode, isSafeString, shouldCoerce } from '../../dom/normalize';
import { APPEND_OPCODES } from '../../opcodes';
import DynamicTextContent from '../../vm/content/text';
import { CheckReactive } from './-debug-strip';
import { AssertFilter } from './vm';

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
  let reference = check(vm.stack.top(), CheckReactive);

  const contentType = vm.derefReactive(reference, toContentType);

  if (vm.unwrap(contentType)) {
    vm.stack.push(contentType.value);

    if (!isConstant(reference)) {
      vm.updateWith(new AssertFilter(contentType, reference, toContentType));
    }
  }
});

APPEND_OPCODES.add(Op.DynamicContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReactive);

  const result = vm.derefReactive(reference, toDynamicContentType);

  if (vm.unwrap(result)) {
    vm.stack.push(result.value);

    if (!isConstant(reference)) {
      vm.updateWith(new AssertFilter(result, reference, toDynamicContentType));
    }
  }
});

APPEND_OPCODES.add(Op.AppendHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  const html = vm.derefReactive(reference, (value) => {
    return isEmpty(value) ? '' : String(value);
  });

  if (vm.unwrap(html)) {
    vm.elements().appendDynamicHTML(check(html.value, CheckString));
  }
});

APPEND_OPCODES.add(Op.AppendSafeHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  const html = vm.derefReactive(reference, (value) => {
    const html = check(value, CheckSafeString).toHTML();
    return isEmpty(html) ? '' : check(html, CheckString);
  });

  if (vm.unwrap(html)) {
    vm.elements().appendDynamicHTML(html.value);
  }
});

APPEND_OPCODES.add(Op.AppendText, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  let result = vm.derefReactive(reference, (value) => (isEmpty(value) ? '' : String(value)));

  if (vm.unwrap(result)) {
    let node = vm.elements().appendDynamicText(result.value);

    if (!isConstant(reference)) {
      vm.updateWith(new DynamicTextContent(node, reference, result.value));
    }
  }
});

APPEND_OPCODES.add(Op.AppendDocumentFragment, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);
  const result = vm.derefReactive(reference);

  if (vm.unwrap(result)) {
    vm.elements().appendDynamicFragment(check(result.value, CheckDocumentFragment));
  }
});

APPEND_OPCODES.add(Op.AppendNode, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);
  const result = vm.derefReactive(reference);

  if (vm.unwrap(result)) {
    vm.elements().appendDynamicNode(check(result.value, CheckNode));
  }
});
