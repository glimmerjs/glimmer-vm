import type {DeclaredComponentType, RenderDelegate, RenderDelegateOptions} from '@glimmer-workspace/integration-tests';
import {
  ClientSideRenderDelegate,
  ErrorRecoveryRenderDelegate,
RenderTestContext,  RenderTestState
 } from '@glimmer-workspace/integration-tests';

const { module, test } = QUnit;

interface RenderDelegateClass {
  readonly style: string;
  new (options?: RenderDelegateOptions): RenderDelegate;
}

export interface CoreMatrixOptions {
  template: DeclaredComponentType | 'all' | undefined;
  invokeAs?: DeclaredComponentType | 'all' | undefined;
}

export type MatrixOptions = CoreMatrixOptions &
  (
    | {
        delegate: RenderDelegateClass;
      }
    | {
        delegates: RenderDelegateClass[];
      }
  );

const EXPANSIONS = {
  curly: ['curly', 'dynamic'],
  glimmer: ['glimmer', 'templateOnly'],
  dynamic: ['dynamic'],
  templateOnly: ['templateOnly'],
  all: ['curly', 'glimmer', 'dynamic', 'templateOnly'],
} as const;
type EXPANSIONS = typeof EXPANSIONS;

function expand(
  test: Partial<CoreMatrixOptions> | undefined,
  suite: Partial<CoreMatrixOptions>
): {
  template: DeclaredComponentType;
  invokeAs: DeclaredComponentType;
}[] {
  const template = EXPANSIONS[test?.template ?? suite.template ?? 'all'];
  // const invokeAs= EXPANSIONS[test.invokeAs ?? suite.invokeAs ];

  return template.flatMap((t) => {
    return [{ template: t, invokeAs: t }];
    // return invokeAs.map((i) => {
    //   return { template: t, invokeAs: i };
    // });
  });
}

interface TestsFn<T> {
  (
    ...args:
      | [description: string, body: (context: T) => void | Promise<void>]
      | [
          options: {
            type: DeclaredComponentType;
          },
          description: string,
          body: (context: T) => void | Promise<void>,
        ]
  ): void;
}

interface CustomOptions<T extends RenderTestContext> {
  context: new (delegate: RenderDelegate, context: RenderTestState) => T;
  extends?: Matrix | Matrix[];
}

type MatrixFn = (options: MatrixOptions) => void;

export class Matrix {
  readonly #fn: MatrixFn;

  constructor(fn: MatrixFn) {
    this.#fn = fn;
  }

  client() {
    this.#fn({
      delegates: [ClientSideRenderDelegate, ErrorRecoveryRenderDelegate],
      template: 'all',
      invokeAs: 'all',
    });
  }

  test(delegate: RenderDelegateClass) {
    this.#fn({
      delegate,
      template: 'all',
      invokeAs: 'all',
    });
  }

  apply(options: MatrixOptions) {
    this.#fn(options);
  }
}

export function matrix(
  description: string,
  define: (define: TestsFn<RenderTestContext>) => void
): Matrix;
export function matrix<const T extends RenderTestContext>(
  custom: CustomOptions<T>,
  description: string,
  define: (define: TestsFn<T>) => void
): Matrix;
export function matrix<const T extends RenderTestContext>(
  ...args:
    | [description: string, define: (define: TestsFn<T>) => void]
    | [custom: CustomOptions<T>, description: string, define: (define: TestsFn<T>) => void]
): Matrix {
  const [{ context: Context, extends: extendsMatrix }, description, define] =
    args.length === 2
      ? [{ context: RenderTestContext } satisfies CustomOptions<RenderTestContext>, ...args]
      : args;

  const extendsMatrixes = extendsMatrix
    ? Array.isArray(extendsMatrix)
      ? extendsMatrix
      : [extendsMatrix]
    : [];

  return new Matrix((options: MatrixOptions) => {
    const delegates = 'delegate' in options ? [options.delegate] : options.delegates;

    for (const delegate of delegates) {
      for (const matrix of extendsMatrixes) {
        matrix.apply({
          delegate: delegate,
          template: options.template,
          invokeAs: options.invokeAs,
        });
      }
    }

    module(description, () => {
      for (const delegate of delegates) {
        const TESTS: Record<
          /* DeclaredComponentType */ string,
          [description: string, test: (assert: Assert) => void | Promise<void>][]
        > = {};

        const tests: TestsFn<T> = (...args) => {
          const [testOptions, description, fn] =
            args.length === 2 ? ([undefined, ...args] as const) : args;

          const fullMatrix = expand({ template: testOptions?.type }, options);

          for (const row of fullMatrix) {
            TESTS[row.template] ??= [];

            TESTS[row.template]?.push([
              description,
              (assert) => {
                const context = new Context(
                  new delegate(),
                  RenderTestState(assert, row.template)
                ) as T;
                return fn(context);
              },
            ]);
          }
        };

        define(tests);

        module(`[${delegate.style} style]`, () => {
          for (const [type, tests] of Object.entries(TESTS)) {
            module(type, () => {
              for (const [description, testFn] of tests) {
                test(description, testFn);
              }
            });
          }
        });
      }
    });
  });
}
