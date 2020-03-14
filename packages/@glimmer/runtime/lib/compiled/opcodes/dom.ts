import { Reference, ReferenceCache } from '@glimmer/reference';
import { isConstMemo } from '@glimmer/validator';
import {
  check,
  CheckString,
  CheckElement,
  CheckOption,
  CheckNode,
  CheckMaybe,
} from '@glimmer/debug';
import { Op, Option, ModifierManager } from '@glimmer/interfaces';
import { $t0 } from '@glimmer/vm';
import { ModifierDefinition } from '../../modifier/interfaces';
import { APPEND_OPCODES, UpdatingOpcode } from '../../opcodes';
import { UpdatingVM } from '../../vm';
import { Assert } from './vm';
import { DynamicAttribute } from '../../vm/attributes/dynamic';
import { CheckReference, CheckArguments, CheckOperations } from './-debug-strip';
import { CONSTANTS } from '../../symbols';
import { SimpleElement, SimpleNode } from '@simple-dom/interface';
import { expect } from '@glimmer/util';
import { EffectImpl } from '../../environment';

APPEND_OPCODES.add(Op.Text, (vm, { op1: text }) => {
  vm.elements().appendText(vm[CONSTANTS].getString(text));
});

APPEND_OPCODES.add(Op.Comment, (vm, { op1: text }) => {
  vm.elements().appendComment(vm[CONSTANTS].getString(text));
});

APPEND_OPCODES.add(Op.OpenElement, (vm, { op1: tag }) => {
  vm.elements().openElement(vm[CONSTANTS].getString(tag));
});

APPEND_OPCODES.add(Op.OpenDynamicElement, vm => {
  let tagName = check(check(vm.stack.pop(), CheckReference).value(), CheckString);
  vm.elements().openElement(tagName);
});

APPEND_OPCODES.add(Op.PushRemoteElement, vm => {
  let elementRef = check(vm.stack.pop(), CheckReference);
  let insertBeforeRef = check(vm.stack.pop(), CheckReference);
  let guidRef = check(vm.stack.pop(), CheckReference);

  let element = check(elementRef.value(), CheckElement);
  let insertBefore = check(insertBeforeRef.value(), CheckMaybe(CheckOption(CheckNode)));
  let guid = guidRef.value() as string;

  if (!isConstMemo(elementRef.value)) {
    let cache = new ReferenceCache(elementRef as Reference<SimpleElement>);
    vm.updateWith(new Assert(cache));
  }

  if (insertBefore !== undefined && !isConstMemo(insertBeforeRef.value)) {
    let cache = new ReferenceCache(insertBeforeRef as Reference<Option<SimpleNode>>);
    vm.updateWith(new Assert(cache));
  }

  let block = vm.elements().pushRemoteElement(element, guid, insertBefore);
  if (block) vm.associateDestroyable(block);
});

APPEND_OPCODES.add(Op.PopRemoteElement, vm => {
  vm.elements().popRemoteElement();
});

APPEND_OPCODES.add(Op.FlushElement, vm => {
  let operations = check(vm.fetchValue($t0), CheckOperations);
  let modifiers: Option<[ModifierManager, unknown][]> = null;

  if (operations) {
    modifiers = operations.flush(vm);
    vm.loadValue($t0, null);
  }

  vm.elements().flushElement(modifiers);
});

APPEND_OPCODES.add(Op.CloseElement, vm => {
  let modifiers = vm.elements().closeElement();

  if (modifiers) {
    modifiers.forEach(([manager, modifier]) => {
      let effect = new EffectImpl({
        setup() {
          manager.install(modifier);
        },

        update() {
          manager.update(modifier);
        },

        teardown() {
          manager.teardown(modifier);
        },
      });

      vm.env.registerEffect(effect, true);
      vm.associateDestroyable(effect);
    });
  }
});

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  let { manager, state } = vm.runtime.resolver.resolve<ModifierDefinition>(handle);
  let stack = vm.stack;
  let args = check(stack.pop(), CheckArguments);
  let { constructing, updateOperations } = vm.elements();
  let dynamicScope = vm.dynamicScope();
  let modifier = manager.create(
    expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
    state,
    args,
    dynamicScope,
    updateOperations
  );

  let operations = expect(
    check(vm.fetchValue($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  operations.addModifier(manager, modifier);

  // let tag = manager.getTag(modifier);

  // if (!isConstTag(tag)) {
  //   vm.updateWith(new UpdateModifierOpcode(tag, manager, modifier));
  // }
});

// export class UpdateModifierOpcode extends UpdatingOpcode {
//   public type = 'update-modifier';
//   private lastUpdated: Revision;

//   constructor(
//     public tag: Tag,
//     private manager: InternalModifierManager,
//     private modifier: ModifierInstanceState
//   ) {
//     super();
//     this.lastUpdated = valueForTag(tag);
//   }

//   evaluate(vm: UpdatingVM) {
//     let { manager, modifier, tag, lastUpdated } = this;

//     if (!validateTag(tag, lastUpdated)) {
//       vm.env.scheduleUpdateModifier(modifier, manager);
//       this.lastUpdated = valueForTag(tag);
//     }
//   }
// }

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getString(_name);
  let value = vm[CONSTANTS].getString(_value);
  let namespace = _namespace ? vm[CONSTANTS].getString(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getString(_name);
  let reference = check(vm.stack.pop(), CheckReference);
  let value = reference.value();
  let namespace = _namespace ? vm[CONSTANTS].getString(_namespace) : null;

  let attribute = vm.elements().setDynamicAttribute(name, value, !!trusting, namespace);

  if (!isConstMemo(reference.value)) {
    vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute));
  }
});

export class UpdateDynamicAttributeOpcode extends UpdatingOpcode {
  public type = 'patch-element';

  private lastValue: unknown;

  constructor(private reference: Reference<unknown>, private attribute: DynamicAttribute) {
    super();
    this.lastValue = reference.value();
  }

  evaluate(vm: UpdatingVM) {
    let { attribute, reference, lastValue } = this;
    let currentValue = reference.value();

    if (currentValue !== lastValue) {
      attribute.update(currentValue, vm.env);
      this.lastValue = currentValue;
    }
  }
}
