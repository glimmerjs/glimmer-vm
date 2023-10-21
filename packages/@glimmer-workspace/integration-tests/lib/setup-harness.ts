/* eslint-disable no-console */
import type { Expand } from '@glimmer/interfaces';
import { debug } from '@glimmer/validator';
import { autoRegister } from 'js-reporters';

export async function setupQunit() {
  const qunitLib = await import('qunit');
  await import('qunit/qunit/qunit.css');

  const testing = Testing.withConfig(
    {
      id: 'smoke_tests',
      label: 'Enable Smoke Tests',
      tooltip: 'Enable Smoke Tests',
    },
    {
      id: 'ci',
      label: 'Enable CI Mode',
      tooltip: 'CI mode makes tests run faster by sacrificing UI responsiveness',
    },
    {
      id: 'enable_trace_logging',
      label: 'Enable Trace Logging',
      tooltip: 'Trace logs emit information about the internal VM state',
    },
    {
      id: 'enable_tap',
      label: 'Enable Tap',
      value: {
        in_ci: 'only in CI (default)',
        never: 'never',
        always: 'always',
      },
    }
  );

  const runner = autoRegister();
  // @ts-expect-error qunit types don't expose "reporters"
  const tap = qunit.reporters.tap;
  tap.init(runner, { log: console.info });

  testing.begin(() => {
    function isTapEnabled() {
      let tap = testing.config.enable_tap;
      let ci = testing.config.ci;

      switch (tap) {
        case 'in_ci':
        case undefined:
          return !!ci;
        case 'never':
          return false;
        case 'always':
          return true;
      }
    }

    if (isTapEnabled()) {
      const tap = qunitLib.reporters.tap;
      tap.init(runner, { log: console.info });
    }
  });

  await Promise.resolve();

  const qunitDiv = document.createElement('div');
  qunitDiv.id = 'qunit';
  const qunitFixtureDiv = document.createElement('div');
  qunitFixtureDiv.id = 'qunit-fixture';

  document.body.append(qunitDiv, qunitFixtureDiv);

  console.log(`[HARNESS] ci=${hasFlag('ci')}`);

  testing.testStart(() => {
    debug.resetTrackingTransaction?.();
  });

  if (!hasFlag('ci')) {
    // since all of our tests are synchronous, the QUnit
    // UI never has a chance to rerender / update. This
    // leads to a very long "white screen" when running
    // the tests
    //
    // this adds a very small amount of async, just to allow
    // the QUnit UI to rerender once per module completed
    const pause = () =>
      new Promise<void>((res) => {
        setTimeout(res, 1);
      });

    let start = performance.now();
    qunitLib.testDone(async () => {
      let gap = performance.now() - start;
      if (gap > 200) {
        await pause();
        start = performance.now();
      }
    });

    qunitLib.moduleDone(pause);
  }

  qunitLib.done(() => {
    console.log('[HARNESS] done');
  });

  return {
    smokeTest: hasFlag('smoke_test'),
  };
}

class Testing<Q extends typeof QUnit> {
  static withConfig<const C extends readonly UrlConfig[]>(...configs: C): Testing<WithConfig<C>> {
    return new Testing(withConfig(...configs));
  }

  readonly #qunit: Q;

  constructor(qunit: Q) {
    this.#qunit = qunit;
  }

  get config(): Q['config'] {
    return this.#qunit.config;
  }

  readonly begin = (begin: (details: QUnit.BeginDetails) => void | Promise<void>): void => {
    this.#qunit.begin(begin);
  };

  readonly testStart = (
    callback: (details: QUnit.TestStartDetails) => void | Promise<void>
  ): void => {
    this.#qunit.testStart(callback);
  };
}

function hasFlag(flag: string): boolean {
  switch (flag) {
    case 'enable_tap':
      return hasSpecificFlag('enable_tap') || hasSpecificFlag('ci');
    default:
      return hasSpecificFlag(flag);
  }
}

function hasSpecificFlag(flag: string): boolean {
  let location = typeof window !== 'undefined' && window.location;
  return location && new RegExp(`[?&]${flag}`).test(location.search);
}

interface UrlConfig {
  id: string;
  label?: string | undefined;
  tooltip?: string | undefined;
  value?: string | string[] | { [key: string]: string } | undefined;
}

type WithConfig<C extends readonly UrlConfig[]> = typeof QUnit & {
  config: QUnit['config'] & {
    [P in C[number]['id']]: string | undefined;
  };
};

function withConfig<const C extends readonly UrlConfig[]>(...configs: C): Expand<WithConfig<C>> {
  for (let config of configs) {
    QUnit.config.urlConfig.push(config);
  }

  return QUnit as any;
}
