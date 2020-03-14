import { module, test } from './utils/qunit';

import { createTag, consumeTag, dirtyTag, isConstMemo } from '@glimmer/validator';

import {
  ComponentRootReference,
  HelperRootReference,
  PropertyReference,
  IterationItemReference,
  TemplatePathReference,
  UNDEFINED_REFERENCE,
} from '..';
import { TestEnv } from './utils/template';
import {
  EMPTY_ARGS,
  CapturedNamedArgumentsImpl,
  CapturedPositionalArgumentsImpl,
  CapturedArgumentsImpl,
} from '@glimmer/runtime';

module('@glimmer/reference: template', () => {
  module('ComponentRootReference', () => {
    test('it creates a reference with the component as the value', assert => {
      let component = {};
      let ref = new ComponentRootReference(component, new TestEnv());

      assert.equal(ref.value(), component);
    });

    test('it creates PropertyReferences when chained', assert => {
      let component = { foo: 'bar' };
      let ref = new ComponentRootReference(component, new TestEnv());
      let propRef = ref.get('foo');

      assert.ok(propRef instanceof PropertyReference);
      assert.equal(propRef.value(), 'bar');
    });

    test('it calls setTemplatePathDebugContext on the first `get`', assert => {
      let count = 0;

      let component = { foo: 'bar' };
      let ref = new ComponentRootReference(
        component,
        new (class extends TestEnv {
          setTemplatePathDebugContext(_ref: TemplatePathReference, key: string) {
            if (count === 0) {
              count++;
              assert.equal(ref, _ref);
              assert.equal(key, 'this');
            }
          }
        })()
      );

      ref.get('foo');
    });
  });

  module('HelperRootReference', () => {
    test('constant helper values are constant', assert => {
      let ref = new HelperRootReference(() => 123, EMPTY_ARGS, new TestEnv());

      assert.equal(ref.value(), 123, 'value is calculated correctly');
      assert.ok(isConstMemo(ref.value), 'value is constant');
    });

    test('non-constant helper values are non-constant if arguments are not constant', assert => {
      let tag = createTag();

      const EMPTY_POSITIONAL = new CapturedPositionalArgumentsImpl([
        {
          value() {
            consumeTag(tag);
            return 123;
          },
          get() {
            return UNDEFINED_REFERENCE;
          },
        },
      ]);
      const EMPTY_NAMED = new CapturedNamedArgumentsImpl([], []);
      const MUTABLE_ARGS = new CapturedArgumentsImpl(EMPTY_POSITIONAL, EMPTY_NAMED, 0);

      let ref = new HelperRootReference(
        args => args.positional.at(0).value(),
        MUTABLE_ARGS,
        new TestEnv()
      );

      assert.equal(ref.value(), 123, 'value is calculated correctly');
      assert.notOk(isConstMemo(ref.value), 'value is not constant');
    });

    test('non-constant helper values are non-constant if helper is not constant', assert => {
      let tag = createTag();
      let ref = new HelperRootReference(
        () => {
          consumeTag(tag);
          return 123;
        },
        EMPTY_ARGS,
        new TestEnv()
      );

      assert.equal(ref.value(), 123, 'value is calculated correctly');
      assert.notOk(isConstMemo(ref.value), 'value is not constant');
    });

    test('it creates PropertyReferences when chained', assert => {
      let ref = new HelperRootReference(() => ({ foo: 'bar' }), EMPTY_ARGS, new TestEnv());
      let propRef = ref.get('foo');

      assert.ok(propRef instanceof PropertyReference);
      assert.equal(propRef.value(), 'bar');
    });

    test('it calls setTemplatePathDebugContext on initialization', assert => {
      const myHelper = () => 123;

      new HelperRootReference(
        myHelper,
        EMPTY_ARGS,
        new (class extends TestEnv {
          setTemplatePathDebugContext(ref: TemplatePathReference, key: string) {
            assert.ok(ref instanceof HelperRootReference);
            assert.ok(key.match(/result of a `.*` helper/));
          }
        })()
      );
    });

    test('it calls getTemplatePathDebugContext on when computing', assert => {
      const myHelper = () => 123;

      new HelperRootReference(
        myHelper,
        EMPTY_ARGS,
        new (class extends TestEnv {
          getTemplatePathDebugContext(ref: TemplatePathReference) {
            assert.ok(ref instanceof HelperRootReference);
            return '';
          }
        })()
      );
    });
  });

  module('PropertyReference', () => {
    test('it chains off the parent value', assert => {
      let component = { foo: { bar: 'baz' } };
      let ref = new ComponentRootReference(component, new TestEnv());

      let fooRef = ref.get('foo');
      assert.ok(fooRef instanceof PropertyReference);
      assert.equal(fooRef.value(), component.foo);

      let barRef = fooRef.get('bar');
      assert.ok(barRef instanceof PropertyReference);
      assert.equal(barRef.value(), component.foo.bar);
    });

    test('it tracks access', assert => {
      let tag = createTag();
      let count = 0;

      let component = {
        _foo: 123,

        get foo() {
          count++;
          consumeTag(tag);
          return this._foo;
        },

        set foo(value) {
          dirtyTag(tag);
          this._foo = value;
        },
      };

      let ref = new ComponentRootReference(component, new TestEnv());

      let fooRef = ref.get('foo');
      assert.equal(fooRef.value(), 123, 'gets the value correctly');
      assert.equal(count, 1, 'getter is actually called');

      assert.equal(fooRef.value(), 123, 'gets the value correctly');
      assert.equal(count, 1, 'getter is not called again');

      component.foo = 234;

      assert.equal(fooRef.value(), 234, 'gets the value correctly');
      assert.equal(count, 2, 'getter is called again after update');
    });

    test('it correctly caches values', assert => {
      let count = 0;

      let component = {
        _foo: 123,

        get foo() {
          count++;
          return this._foo;
        },
      };

      let ref = new ComponentRootReference(component, new TestEnv());

      let fooRef = ref.get('foo');
      fooRef.value();
      fooRef.value();
      assert.equal(count, 1);
    });

    test('it calls getPath', assert => {
      let component = {};
      let ref = new ComponentRootReference(
        component,
        new (class extends TestEnv {
          getPath(obj: unknown, key: string) {
            assert.equal(obj, component);
            assert.equal(key, 'foo');

            return 123;
          }
        })()
      );

      let fooRef = ref.get('foo');
      assert.equal(fooRef.value(), 123);
    });

    test('it calls setTemplatePathDebugContext on initialization', assert => {
      let count = 0;

      let component = { foo: 'bar' };
      let ref = new ComponentRootReference(
        component,
        new (class extends TestEnv {
          setTemplatePathDebugContext(
            childRef: TemplatePathReference,
            key: string,
            parentRef: TemplatePathReference
          ) {
            if (count === 1) {
              assert.ok(childRef instanceof PropertyReference);
              assert.equal(key, 'foo');
              assert.equal(ref, parentRef);
            }

            count++;
          }
        })()
      );

      ref.get('foo');
    });

    test('it calls getTemplatePathDebugContext on when computing', assert => {
      let component = { foo: 123 };
      let ref = new ComponentRootReference(
        component,
        new (class extends TestEnv {
          getTemplatePathDebugContext(debugRef: TemplatePathReference) {
            assert.equal((debugRef as any).propertyKey, 'foo', 'path ref is registered properly');

            return '';
          }
        })()
      );

      ref.get('foo');
    });
  });

  module('IterationItemReference', () => {
    test('it creates PropertyReferences when chained', assert => {
      let componentRef = new ComponentRootReference({}, new TestEnv());
      let itemRef = new IterationItemReference(componentRef, { foo: 'bar' }, 1, new TestEnv());
      let propRef = itemRef.get('foo');

      assert.ok(propRef instanceof PropertyReference);
      assert.equal(propRef.value(), 'bar');
    });

    test('it correctly calls setTemplatePathDebugContext', assert => {
      let componentRef = new ComponentRootReference({}, new TestEnv());

      new IterationItemReference(
        componentRef,
        { foo: 'bar' },
        1,
        new (class extends TestEnv {
          setTemplatePathDebugContext(
            childRef: TemplatePathReference,
            key: string,
            parentRef: TemplatePathReference
          ) {
            assert.ok(childRef instanceof IterationItemReference);
            assert.equal(key, 1);
            assert.equal(componentRef, parentRef);
          }
        })()
      );
    });
  });
});
