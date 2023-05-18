import { capabilityMaskFrom, managerHasCapability } from '@glimmer/manager';
import { DYNAMIC_LAYOUT_CAPABILITY, DYNAMIC_TAG_CAPABILITY, PREPARE_ARGS_CAPABILITY, CREATE_ARGS_CAPABILITY, ATTRIBUTE_HOOK_CAPABILITY, ELEMENT_HOOK_CAPABILITY, DYNAMIC_SCOPE_CAPABILITY, CREATE_CALLER_CAPABILITY, UPDATE_HOOK_CAPABILITY, CREATE_INSTANCE_CAPABILITY, WILL_DESTROY_CAPABILITY, HAS_SUB_OWNER_CAPABILITY } from '@glimmer/vm-constants';

QUnit.module('Capabilities Bitmaps');

QUnit.test('encodes a capabilities object into a bitmap', (assert) => {
  assert.strictEqual(
    capabilityMaskFrom({
      dynamicLayout: false,
      dynamicTag: false,
      prepareArgs: false,
      createArgs: false,
      attributeHook: false,
      elementHook: false,
      dynamicScope: false,
      createCaller: false,
      updateHook: false,
      createInstance: false,
      wrapped: false,
      willDestroy: false,
      hasSubOwner: false,
    }),
    0b0000000000000,
    'empty capabilities'
  );

  assert.strictEqual(
    capabilityMaskFrom({
      dynamicLayout: true,
      dynamicTag: true,
      prepareArgs: true,
      createArgs: true,
      attributeHook: true,
      elementHook: true,
      dynamicScope: true,
      createCaller: true,
      updateHook: true,
      createInstance: true,
      wrapped: true,
      willDestroy: true,
      hasSubOwner: true,
    }),
    0b1111111111111,
    'all capabilities'
  );

  assert.strictEqual(
    capabilityMaskFrom({
      dynamicLayout: true,
      dynamicTag: false,
      prepareArgs: true,
      createArgs: false,
      attributeHook: false,
      elementHook: true,
      dynamicScope: false,
      createCaller: false,
      updateHook: true,
      createInstance: false,
      wrapped: true,
      willDestroy: false,
      hasSubOwner: false,
    }),
    0b0010100100101,
    'random sample'
  );
});

QUnit.test('allows querying bitmap for a capability', (assert) => {
  let capabilities = capabilityMaskFrom({
    dynamicLayout: true,
    dynamicTag: false,
    prepareArgs: true,
    createArgs: false,
    attributeHook: false,
    elementHook: true,
    dynamicScope: true,
    createCaller: false,
    updateHook: true,
    createInstance: false,
    wrapped: true,
    willDestroy: false,
    hasSubOwner: false,
  });

  assert.true(
    managerHasCapability({} as any, capabilities, DYNAMIC_LAYOUT_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, DYNAMIC_TAG_CAPABILITY)
  );
  assert.true(
    managerHasCapability({} as any, capabilities, PREPARE_ARGS_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, CREATE_ARGS_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, ATTRIBUTE_HOOK_CAPABILITY)
  );
  assert.true(
    managerHasCapability({} as any, capabilities, ELEMENT_HOOK_CAPABILITY)
  );
  assert.true(
    managerHasCapability({} as any, capabilities, DYNAMIC_SCOPE_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, CREATE_CALLER_CAPABILITY)
  );
  assert.true(
    managerHasCapability({} as any, capabilities, UPDATE_HOOK_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, CREATE_INSTANCE_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, WILL_DESTROY_CAPABILITY)
  );
  assert.false(
    managerHasCapability({} as any, capabilities, HAS_SUB_OWNER_CAPABILITY)
  );
});
