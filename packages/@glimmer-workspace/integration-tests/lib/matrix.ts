import {
  type DeclaredComponentType,
  type RenderDelegate,
  type RenderDelegateOptions,
  RenderTestState,
} from '@glimmer-workspace/integration-tests';
import { RenderTestContext } from '@glimmer-workspace/integration-tests';

const { module, test } = QUnit;

interface RenderDelegateClass {
  readonly style: string;
  new (options?: RenderDelegateOptions): RenderDelegate;
}

export interface CoreMatrixOptions {
  inherited?: string;
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
  test: MatrixOptions,
  suite: MatrixOptions
): {
  template: DeclaredComponentType;
  invokeAs: DeclaredComponentType;
}[] {
  const template = EXPANSIONS[test.template ?? suite.template ?? 'all'];
  // const invokeAs= EXPANSIONS[test.invokeAs ?? suite.invokeAs ];

  return template.flatMap((t) => {
    return [{ template: t, invokeAs: t }];
    // return invokeAs.map((i) => {
    //   return { template: t, invokeAs: i };
    // });
  });
}

type TestsFn<T> = (description: string, body: (context: T) => void | Promise<void>) => void;

interface CustomOptions<T extends RenderTestContext> {
  context: new (delegate: RenderDelegate, context: RenderTestState) => T;
  extends?: Matrix | Matrix[];
}

type Matrix = (options: MatrixOptions) => void;

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
) {
  const [{ context: Context, extends: extendsMatrix }, description, define] =
    args.length === 2
      ? [{ context: RenderTestContext } satisfies CustomOptions<RenderTestContext>, ...args]
      : args;

  const extendsMatrixes = extendsMatrix
    ? Array.isArray(extendsMatrix)
      ? extendsMatrix
      : [extendsMatrix]
    : [];

  return (options: MatrixOptions) => {
    const delegates = 'delegate' in options ? [options.delegate] : options.delegates;

    for (const delegate of delegates) {
      for (const matrix of extendsMatrixes) {
        matrix({
          inherited: description,
          delegate: delegate,
          template: options.template,
          invokeAs: options.invokeAs,
        });
      }
    }

    const fullMatrix = expand(options, options);
    module(description, () => {
      for (const delegate of delegates) {
        module(`[${delegate.style} style]`, () => {
          for (const row of fullMatrix) {
            const tests: TestsFn<T> = (description, body) => {
              test(description, (assert) => {
                const context = new Context(
                  new delegate(),
                  RenderTestState(assert, row.template)
                ) as T;
                return body(context);
              });
            };

            define(tests);
          }
        });
      }
    });
  };
}
