import type {
  CapturedArguments,
  CapturedRenderNode,
  CustomRenderNode,
  Dict,
  InternalComponentManager,
  MinimalChild,
  MinimalElement,
  Owner,
  SimpleNode,
} from '@glimmer/interfaces';
import { setComponentTemplate } from '@glimmer/manager';
import {
  EMPTY_ARGS,
  type TemplateOnlyComponent,
  templateOnlyComponent,
  TemplateOnlyComponentManager,
} from '@glimmer/runtime';
import { expect } from '@glimmer/util';
import {
  BrowserRenderTest,
  type EmberishCurlyComponent,
} from '@glimmer-workspace/integration-tests';
import {
  BaseEnvironment,
  GlimmerishComponent,
  JitRenderDelegate,
  createTemplate,
  test,
  suite,
} from '@glimmer-workspace/integration-tests';
import { expectingRenderError } from '@glimmer/local-debug-flags';

interface CapturedBounds {
  parentElement: MinimalElement;
  firstNode: MinimalChild;
  lastNode: MinimalChild;
}

type Expected<T> = T | ((actual: T) => boolean);

function isExpectedFunction<T>(expected: Expected<T>): expected is (actual: T) => boolean {
  return typeof expected === 'function';
}

interface ExpectedRenderNode {
  type: CapturedRenderNode['type'];
  name: CapturedRenderNode['name'];
  args: Expected<CapturedRenderNode['args']>;
  instance: Expected<CapturedRenderNode['instance']>;
  template: Expected<CapturedRenderNode['template']>;
  bounds: Expected<CapturedRenderNode['bounds']>;
  children: Expected<CapturedRenderNode['children']> | ExpectedRenderNode[];
}

class DebugRenderTreeDelegate extends JitRenderDelegate {
  registerCustomComponent(
    name: string,
    template: string,
    Manager: { new (): InternalComponentManager<unknown> }
  ) {
    let ComponentClass = templateOnlyComponent();

    setComponentTemplate(createTemplate(template), ComponentClass);

    let definition = {
      name,
      state: ComponentClass,
      manager: new Manager(),
      template: null,
    };

    this.registry.register('component', name, definition);
  }
}

class DebugRenderTreeTest extends BrowserRenderTest {
  static suiteName = 'Application test: debug render tree';

  declare delegate: DebugRenderTreeDelegate;

  @test 'template-only components'() {
    this.registerComponent('TemplateOnly', 'HelloWorld', '{{@arg}}');

    this.render(
      `<HelloWorld @arg="first"/>{{#if this.showSecond}}<HelloWorld @arg="second"/>{{/if}}`,
      {
        showSecond: false,
      }
    );

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: true });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'second' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.lastChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: false });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);
  }

  @test 'emberish curly components'() {
    this.registerComponent('Curly', 'HelloWorld', 'Hello World');

    this.render(
      `<HelloWorld @arg="first"/>{{#if this.showSecond}}<HelloWorld @arg="second"/>{{/if}}`,
      {
        showSecond: false,
      }
    );

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: EmberishCurlyComponent) => (instance as any).arg === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: true });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: EmberishCurlyComponent) => (instance as any).arg === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'second' } },
        instance: (instance: EmberishCurlyComponent) => (instance as any).arg === 'second',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.lastChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: false });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: EmberishCurlyComponent) => (instance as any).arg === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);
  }

  @test 'glimmerish components'() {
    this.registerComponent('Glimmer', 'HelloWorld', 'Hello World');

    this.render(
      `<HelloWorld @arg="first"/>{{#if this.showSecond}}<HelloWorld @arg="second"/>{{/if}}`,
      {
        showSecond: false,
      }
    );

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: GlimmerishComponent) => instance.args['arg'] === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: true });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: GlimmerishComponent) => instance.args['arg'] === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'second' } },
        instance: (instance: GlimmerishComponent) => instance.args['arg'] === 'second',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.lastChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: false });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld',
        args: { positional: [], named: { arg: 'first' } },
        instance: (instance: GlimmerishComponent) => instance.args['arg'] === 'first',
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);
  }

  @test 'getDebugCustomRenderTree works'() {
    let bucket1 = {};
    let instance1 = {};

    let bucket2 = {};
    let instance2 = {};

    this.delegate.registerCustomComponent(
      'HelloWorld',
      '{{@arg}}',
      class extends TemplateOnlyComponentManager {
        getDebugCustomRenderTree(
          _definition: TemplateOnlyComponent,
          _state: null,
          args: CapturedArguments
        ): CustomRenderNode[] {
          return [
            {
              bucket: bucket1,
              type: 'route-template',
              name: 'foo',
              instance: instance1,
              args,
              template: undefined,
            },
            {
              bucket: bucket2,
              type: 'engine',
              name: 'bar',
              instance: instance2,
              args: EMPTY_ARGS,
              template: undefined,
            },
          ];
        }
      }
    );

    this.registerComponent('TemplateOnly', 'HelloWorld2', '{{@arg}}');

    this.render(
      `<HelloWorld2 @arg="first"/>{{#if this.showSecond}}<HelloWorld @arg="second"/>{{/if}}`,
      {
        showSecond: false,
      }
    );

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: true });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
      {
        type: 'route-template',
        name: 'foo',
        args: { positional: [], named: { arg: 'second' } },
        instance: instance1,
        template: null,
        bounds: this.nodeBounds(this.element.lastChild),
        children: [
          {
            type: 'engine',
            name: 'bar',
            args: { positional: [], named: {} },
            instance: instance2,
            template: null,
            bounds: this.nodeBounds(this.element.lastChild),
            children: [],
          },
        ],
      },
    ]);

    this.rerender({ showSecond: false });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);
  }

  @test 'empty getDebugCustomRenderTree works'() {
    this.delegate.registerCustomComponent(
      'HelloWorld',
      '{{@arg}}',
      class extends TemplateOnlyComponentManager {
        getDebugCustomRenderTree(): CustomRenderNode[] {
          return [];
        }
      }
    );

    this.registerComponent('TemplateOnly', 'HelloWorld2', '{{@arg}}');

    this.render(
      `<HelloWorld2 @arg="first"/>{{#if this.showSecond}}<HelloWorld @arg="second"/>{{/if}}`,
      {
        showSecond: false,
      }
    );

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: true });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);

    this.rerender({ showSecond: false });

    this.assertRenderTree([
      {
        type: 'component',
        name: 'HelloWorld2',
        args: { positional: [], named: { arg: 'first' } },
        instance: null,
        template: '(unknown template module)',
        bounds: this.nodeBounds(this.element.firstChild),
        children: [],
      },
    ]);
  }

  @test 'cleans up correctly after errors'(assert: Assert) {
    this.registerComponent(
      'Glimmer',
      'HelloWorld',
      'Hello World',
      class extends GlimmerishComponent {
        constructor(owner: Owner, args: Dict) {
          super(owner, args);
          throw new Error('oops!');
        }
      }
    );

    assert.throws(() => {
      expectingRenderError(() => this.render('<HelloWorld @arg="first"/>'));
    }, /oops!/u);

    assert.deepEqual(this.delegate.getCapturedRenderTree(), [], 'there was no output');
  }

  nodeBounds(_node: SimpleNode | null): CapturedBounds {
    let node = expect(_node, 'BUG: Expected node');

    return {
      parentElement: expect(node.parentNode, 'BUG: detached node') as unknown as MinimalElement,
      firstNode: node as unknown as MinimalChild,
      lastNode: node as unknown as MinimalChild,
    };
  }

  elementBounds(element: Element): CapturedBounds {
    return {
      parentElement: element as unknown as MinimalElement,
      firstNode: element.firstChild! as unknown as MinimalChild,
      lastNode: element.lastChild! as unknown as MinimalChild,
    };
  }

  assertRenderTree(expected: ExpectedRenderNode[]): void {
    let actual = this.delegate.getCapturedRenderTree();

    this.assertRenderNodes(actual, expected, 'root');
  }

  assertRenderNodes(
    actual: CapturedRenderNode[],
    expectedNodes: ExpectedRenderNode[],
    path: string
  ): void {
    this.assert.strictEqual(
      actual.length,
      expectedNodes.length,
      `Expecting ${expectedNodes.length} render nodes at ${path}, got ${actual.length}.\n`
    );

    if (actual.length === expectedNodes.length) {
      let byTypeAndName = <T, U, V extends { type: T; name: U }>(a: V, b: V): number => {
        if (a.type > b.type) {
          return 1;
        } else if (a.type < b.type) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else if (a.name < b.name) {
          return -1;
        } else {
          return 0;
        }
      };

      actual = actual.sort(byTypeAndName);
      expectedNodes = expectedNodes.sort(byTypeAndName);

      for (let [index, actualNode] of actual.entries()) {
        let expected = this.guardPresent({ [`node (${index})`]: expectedNodes[index] });
        this.assertRenderNode(actualNode, expected, `${actualNode.type}:${actualNode.name}`);
      }
    } else {
      this.assert.deepEqual(actual, [], path);
    }
  }

  assertRenderNode(actual: CapturedRenderNode, expected: ExpectedRenderNode, path: string): void {
    this.assertProperty(actual.type, expected.type, false, `${path} (type)`);
    this.assertProperty(actual.name, expected.name, false, `${path} (name)`);
    this.assertProperty(actual.args, expected.args, true, `${path} (args)`);
    this.assertProperty(actual.instance, expected.instance, false, `${path} (instance)`);
    this.assertProperty(actual.template, expected.template, false, `${path} (template)`);
    this.assertProperty(actual.bounds, expected.bounds, true, `${path} (bounds)`);

    if (Array.isArray(expected.children)) {
      this.assertRenderNodes(actual.children, expected.children, path);
    } else {
      this.assertProperty(actual.children, expected.children, false, `${path} (children)`);
    }
  }

  assertProperty<T>(actual: T, expected: Expected<T>, deep: boolean, path: string): void {
    if (isExpectedFunction(expected)) {
      this.assert.ok(expected(actual), `Matching ${path}, got ${actual}`);
    } else if (deep) {
      this.assert.deepEqual(actual, expected, `Matching ${path}`);
    } else {
      this.assert.strictEqual(actual, expected, `Matching ${path}`);
    }
  }
}

suite(DebugRenderTreeTest, DebugRenderTreeDelegate, {
  env: { ...BaseEnvironment, enableDebugTooling: true },
});
