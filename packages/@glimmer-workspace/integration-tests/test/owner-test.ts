import type {
  CapabilityMask,
  Owner,
  ResolvedComponentDefinition,
  Template,
  WithCreateInstance,
  WithSubOwner,
} from '@glimmer/interfaces';
import { setInternalComponentManager } from '@glimmer/manager';
import { NULL_REFERENCE, type Reference } from '@glimmer/reference';

import {
  createTemplate,
  defineComponent,
  EmberishCurlyComponent,
  GlimmerishComponent,
  JitRenderDelegate,
  type RenderDelegateOptions,
  RenderTest,
  suite,
  test,
  TestJitRuntimeResolver,
} from '..';
import { CREATE_INSTANCE_CAPABILITY, HAS_SUB_OWNER_CAPABILITY } from '@glimmer/vm-constants';

class OwnerJitRuntimeResolver extends TestJitRuntimeResolver {
  override lookupComponent(name: string, owner: () => void): ResolvedComponentDefinition | null {
    if (typeof owner === 'function') owner();

    return super.lookupComponent(name, owner);
  }
}

class OwnerJitRenderDelegate extends JitRenderDelegate {
  constructor(options?: RenderDelegateOptions) {
    super({
      ...options,
      resolver: (registry) => new OwnerJitRuntimeResolver(registry),
    });
  }
}

const CAPABILITIES = (CREATE_INSTANCE_CAPABILITY | HAS_SUB_OWNER_CAPABILITY) as CapabilityMask;

// eslint-disable-next-line unicorn/no-static-only-class
class MountComponent {
  static owner: object;
}

class MountManager implements WithCreateInstance<object>, WithSubOwner<object> {
  getCapabilities(): CapabilityMask {
    return CAPABILITIES;
  }

  getOwner(state: object) {
    return state;
  }

  create(_owner: Owner, state: typeof MountComponent) {
    return state.owner;
  }

  getSelf(): Reference {
    return NULL_REFERENCE;
  }

  didCreate() {}
  didUpdate() {}

  didRenderLayout() {}
  didUpdateLayout() {}

  getDestroyable() {
    return null;
  }

  getDebugName() {
    return 'mount';
  }
}

setInternalComponentManager(new MountManager(), MountComponent);

function defineMountComponent(owner: object, scope: Record<string, unknown>, template: string) {
  return defineComponent(scope, template, {
    definition: class extends MountComponent {
      static override owner = owner;
    },
  });
}

function defineCheckOwnerComponent(ownerToCheck: object | undefined, assert: Assert) {
  return defineComponent({}, '{{yield}}', {
    definition: class extends GlimmerishComponent {
      constructor(owner: object, args: Record<string, unknown>) {
        super(owner, args);

        assert.strictEqual(owner, ownerToCheck, 'owner is correct');
      }
    },
  });
}

function EmberishComponentWithLayout(layout: Template) {
  return class EmberishComponentWithLayout extends EmberishCurlyComponent {
    override layout = layout;
  };
}

class OwnerTest extends RenderTest {
  static suiteName = '[owner]';

  declare delegate: OwnerJitRenderDelegate;

  @test
  'owner can be used per-template in compile time resolver'(assert: Assert) {
    {
      let layout = createTemplate('<FooBaz/>')(() => {
        assert.action('foo-bar owner called');
      });

      this.delegate.registerComponent(
        'Curly',
        'Curly',
        'FooBar',
        null,
        EmberishComponentWithLayout(layout)
      );
    }

    {
      let layout = createTemplate('<FooQux/>')(() => {
        assert.action('foo-baz owner called');
      });

      this.delegate.registerComponent(
        'Curly',
        'Curly',
        'FooBaz',
        null,
        EmberishComponentWithLayout(layout)
      );
    }

    this.delegate.registerComponent('TemplateOnly', 'TemplateOnly', 'FooQux', 'testing');

    this.render('<FooBar/>');

    assert.verifyActions(['foo-bar owner called', 'foo-baz owner called'], 'owners used correctly');
  }

  @test
  'owner can be used per-template in runtime resolver'(assert: Assert) {
    this.delegate.registerComponent('TemplateOnly', 'TemplateOnly', 'FooQux', 'testing');

    {
      let layout = createTemplate('<FooQux/>')(() => {
        assert.action('foo-baz owner called');
      });

      this.delegate.registerComponent(
        'Curly',
        'Curly',
        'FooBaz',
        null,
        EmberishComponentWithLayout(layout)
      );
    }

    {
      let layout = createTemplate('<FooBaz/>')(() => {
        assert.action('foo-bar owner called');
      });

      this.delegate.registerComponent(
        'Curly',
        'Curly',
        'FooBar',
        null,
        EmberishComponentWithLayout(layout)
      );
    }

    this.render('<FooBar/>');

    assert.verifyActions(['foo-bar owner called', 'foo-baz owner called'], 'owners used correctly');
  }

  @test
  'owner can be changed by a component with the hasSubOwner capability'(assert: Assert) {
    let owner1 = { name: 'owner1' };
    let owner2 = { name: 'owner2' };

    let CheckOwner2 = defineCheckOwnerComponent(owner1, assert);
    let CheckOwner1 = defineCheckOwnerComponent(owner1, assert);

    let Mount2 = defineMountComponent(owner2, { CheckOwner2 }, `<CheckOwner2/>{{yield}}`);
    let Mount1 = defineMountComponent(
      owner1,
      { CheckOwner1, Mount2 },
      `<CheckOwner1/><Mount2><CheckOwner1/></Mount2>`
    );

    this.renderComponent(Mount1);
  }

  @test
  'owner is preserved in curried closure components'(assert: Assert) {
    let owner1 = { name: 'owner1' };
    let owner2 = { name: 'owner2' };

    let CheckOwner2 = defineCheckOwnerComponent(owner1, assert);
    let CheckOwner1 = defineCheckOwnerComponent(owner1, assert);

    let Mount2 = defineMountComponent(owner2, { CheckOwner2 }, `<CheckOwner2/><@CheckOwner1/>`);
    let Mount1 = defineMountComponent(
      owner1,
      { CheckOwner1, Mount2 },
      `<CheckOwner1/><Mount2 @CheckOwner1={{component CheckOwner1}}/>`
    );

    this.renderComponent(Mount1);
  }

  // TODO: This behavior could be confusing the users, but currently we don't know of a way
  // to ensure we are using the component with the correct owner if it was not curried.
  // We should continue exploring options here.
  @test
  'owner is preserved in non-curried component definitions that are passed around'(assert: Assert) {
    let owner1 = { name: 'owner1' };
    let owner2 = { name: 'owner2' };

    let CheckOwner2 = defineCheckOwnerComponent(owner1, assert);
    let CheckOwner1 = defineCheckOwnerComponent(owner1, assert);

    let Mount2 = defineMountComponent(owner2, { CheckOwner2 }, `<CheckOwner2/><@CheckOwner2/>`);
    let Mount1 = defineMountComponent(
      owner1,
      { CheckOwner1, CheckOwner2, Mount2 },
      `<CheckOwner1/><Mount2 @CheckOwner2={{CheckOwner2}}/>`
    );

    this.renderComponent(Mount1);
  }

  @test
  'resolution mode components defined within strict mode components receive correct owner during compilation'() {
    this.registerComponent('TemplateOnly', 'Foo', 'Hello, world!');

    let Bar = defineComponent(null, '<Foo/>');
    let Baz = defineComponent({ Bar }, '<Bar/>');

    this.renderComponent(Baz);
  }
}

suite(OwnerTest, OwnerJitRenderDelegate);
