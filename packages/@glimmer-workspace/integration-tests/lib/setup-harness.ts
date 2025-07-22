/* eslint-disable no-console */
import type { Expand } from '@glimmer/interfaces';
import { debug } from '@glimmer/validator';
import { default as QUnit } from 'qunit';

const SMOKE_TEST_FILE = './packages/@glimmer-workspace/integration-tests/test/smoke-test.ts';

export async function runTests(packages: Record<string, () => Promise<void>>) {
  const { smokeTest } = await setupQunit();
  return bootQunit(packages, { smokeTest });
}

export async function bootQunit(
  packages: Record<string, () => Promise<void>>,
  options: { smokeTest?: boolean } = {}
) {
  const { smokeTest } = options;

  for (const [name, pkg] of Object.entries(packages)) {
    if (name === SMOKE_TEST_FILE && !smokeTest) {
      console.log('skipping', name);
      continue;
    }

    await pkg();
  }

  QUnit.start();
}

type QUnitExt = typeof QUnit & {
  reporters: {
    tap: {
      init: (qunit: typeof QUnit, options: { log: (message: string) => void }) => void;
    };
  };
};

declare global {
  const exposedCiLog: undefined | ((message: string) => void);
  const ciHarnessEvent: undefined | ((event: string, details: QUnit.DoneDetails) => void);
}

export async function setupQunit() {
  const qunitLib: QUnit = await import('qunit');
  await import('qunit/qunit/qunit.css');
  await import('./harness/tweaks.css');

  const testing = Testing.withConfig(
    {
      id: 'smoke_tests',
      label: 'Smoke Tests',
      tooltip: 'Enable Smoke Tests',
    },
    {
      id: 'ci',
      label: 'CI Mode',
      tooltip:
        'CI mode emits tap output and makes tests run faster by sacrificing UI responsiveness',
    },
    {
      id: 'headless',
      label: 'Headless Mode',
      tooltip: 'Run tests in headless mode (no UI)',
    },
    {
      id: 'enable_internals_logging',
      label: 'Log Deep Internals',
      tooltip: 'Logs internals that are used in the development of the trace logs',
    },

    {
      id: 'enable_trace_logging',
      label: 'Trace Logs',
      tooltip:
        'Trace logs emit information about the internal VM state. NOTE: Some tests are incompatible with trace logging and may fail.',
    },

    {
      id: 'enable_subtle_logging',
      label: '+ Subtle',
      tooltip:
        'Subtle logs include unchanged information and other details not necessary for normal debugging',
    },

    {
      id: 'enable_trace_explanations',
      label: '+ Explanations',
      tooltip: 'Also explain the trace logs',
    }
  );

  // const runner = autoRegister();

  if (typeof exposedCiLog !== 'undefined') {
    (qunitLib as QUnitExt).reporters.tap.init(qunitLib, {
      log: exposedCiLog,
    });
  }

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

  qunitLib.done((finish) => {
    console.log('[HARNESS] done');

    if (typeof ciHarnessEvent !== 'undefined') {
      ciHarnessEvent('end', finish);
    }
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

  readonly hasFlag = (flag: string): boolean => {
    return hasFlag(flag);
  };

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
  return hasSpecificFlag(flag);
}

function hasSpecificFlag(flag: string): boolean {
  let location = typeof window !== 'undefined' && window.location;
  return location && new RegExp(`[?&]${flag}`, 'u').test(location.search);
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

  const index = QUnit.config.urlConfig.findIndex((c) => c.id === 'noglobals');
  if (index !== -1) {
    QUnit.config.urlConfig.splice(index, 1);
  }

  return QUnit as any;
}
