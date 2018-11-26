import { Reference, Tag, isConst } from '@glimmer/reference';
import { Op } from '@glimmer/vm';
import {
  check,
  CheckString,
  CheckSafeString,
  CheckNode,
  CheckDocumentFragment,
} from '@glimmer/debug';
import { Opaque } from '@glimmer/util';

import { APPEND_OPCODES, OpcodeKind } from '../../opcodes';
import { ConditionalReference } from '../../references';
import {
  isCurriedComponentDefinition,
  isComponentDefinition,
} from '../../component/curried-component';
import { CheckPathReference } from './-debug-strip';
import { isEmpty, isSafeString, isFragment, isNode, shouldCoerce } from '../../dom/normalize';
import DynamicTextContent from '../../vm/content/text';
import { UserValue } from '@glimmer/interfaces';

export class IsCurriedComponentDefinitionReference extends ConditionalReference {
  static create(inner: Reference<unknown>): IsCurriedComponentDefinitionReference {
    return new IsCurriedComponentDefinitionReference(inner);
  }

  toBool(value: Opaque): boolean {
    return isCurriedComponentDefinition(value);
  }
}

export const enum ContentType {
  Component,
  String,
  Empty,
  SafeString,
  Fragment,
  Node,
  Other,
}

export class ContentTypeReference implements Reference<ContentType> {
  public tag: Tag;

  constructor(private inner: Reference<unknown>) {
    this.tag = inner.tag;
  }

  value(): ContentType {
    let value = this.inner.value() as UserValue;

    if (shouldCoerce(value)) {
      return ContentType.String;
    } else if (isComponentDefinition(value)) {
      return ContentType.Component;
    } else if (isSafeString(value)) {
      return ContentType.SafeString;
    } else if (isFragment(value)) {
      return ContentType.Fragment;
    } else if (isNode(value)) {
      return ContentType.Node;
    } else {
      return ContentType.String;
    }
  }
}

APPEND_OPCODES.add(
  Op.AppendHTML,
  vm => {
    let reference = check(vm.stack.pop(), CheckPathReference);

    let rawValue = reference.value() as UserValue;
    let value = isEmpty(rawValue) ? '' : String(rawValue);

    vm.elementsMut.appendDynamicHTML(value);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.AppendSafeHTML,
  vm => {
    let reference = check(vm.stack.pop(), CheckPathReference);

    let rawValue = check(reference.value() as UserValue, CheckSafeString).toHTML();
    let value = isEmpty(rawValue) ? '' : check(rawValue, CheckString);

    vm.elementsMut.appendDynamicHTML(value);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.AppendText,
  vm => {
    let reference = check(vm.stack.pop(), CheckPathReference);

    let rawValue = reference.value();
    let value = isEmpty(rawValue) ? '' : String(rawValue);

    let node = vm.elementsMut.appendDynamicText(value);

    if (!isConst(reference)) {
      vm.updateWith(new DynamicTextContent(node, reference, value));
    }
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.AppendDocumentFragment,
  vm => {
    let reference = check(vm.stack.pop(), CheckPathReference);

    let value = check(reference.value(), CheckDocumentFragment);

    vm.elementsMut.appendDynamicFragment(value);
  },
  OpcodeKind.Mut
);

APPEND_OPCODES.add(
  Op.AppendNode,
  vm => {
    let reference = check(vm.stack.pop(), CheckPathReference);

    let value = check(reference.value(), CheckNode);

    vm.elementsMut.appendDynamicNode(value);
  },
  OpcodeKind.Mut
);
