import type { DynamicContentType } from '@glimmer/vm';
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
import { isObject, LOCAL_LOGGER } from '@glimmer/util';
import {
  COMPONENT_CONTENT,
  CURRIED_COMPONENT,
  CURRIED_HELPER,
  CurriedTypes,
  FRAGMENT_CONTENT,
  HELPER_CONTENT,
  NODE_CONTENT,
  Op,
  SAFE_STRING_CONTENT,
  STRING_CONTENT,
} from '@glimmer/vm';

import { isCurried } from '../../curried-value';
import { isEmpty, isFragment, isNode, isSafeString, shouldCoerce } from '../../dom/normalize';
import { APPEND_OPCODES } from '../../opcodes';
import DynamicTextContent from '../../vm/content/text';
import { CheckReactive } from './-debug-strip';
import { Assert } from './vm';

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

  vm.deref(reference, (value) => {
    const contentType = toContentType(value);
    vm.stack.push(contentType);

    if (!isConstant(reference)) {
      vm.updateWith(Assert.filtered(reference, contentType, toContentType));
    }
  });
});

APPEND_OPCODES.add(Op.DynamicContentType, (vm) => {
  let reference = check(vm.stack.top(), CheckReactive);

  vm.deref(reference, (value) => {
    const contentType = toDynamicContentType(value);
    vm.stack.push(contentType);

    if (!isConstant(reference)) {
      vm.updateWith(Assert.filtered(reference, contentType, toDynamicContentType));
    }
  });
});

APPEND_OPCODES.add(Op.AppendHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (html) => {
    const string = isEmpty(html) ? '' : String(html);
    vm.elements().appendDynamicHTML(check(string, CheckString));
  });
});

APPEND_OPCODES.add(Op.AppendSafeHTML, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    const html = check(value, CheckSafeString).toHTML();
    const string = isEmpty(html) ? '' : check(html, CheckString);

    vm.elements().appendDynamicHTML(string);
  });
});

APPEND_OPCODES.add(Op.AppendText, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    const string = isEmpty(value) ? '' : String(value);

    let node = vm.elements().appendDynamicText(string);

    if (!isConstant(reference)) {
      vm.updateWith(new DynamicTextContent(node, reference, string));
    }
  });
});

APPEND_OPCODES.add(Op.AppendDocumentFragment, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    vm.elements().appendDynamicFragment(check(value, CheckDocumentFragment));
  });
});

APPEND_OPCODES.add(Op.AppendNode, (vm) => {
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    vm.elements().appendDynamicNode(check(value, CheckNode));
  });
});
