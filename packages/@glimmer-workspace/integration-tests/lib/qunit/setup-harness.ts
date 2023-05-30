import './qunit.scss';
import './harness.scss';
import { Reporter } from './reporter';

/* eslint-disable no-console */
import { debug } from '@glimmer/validator';
import { autoRegister } from 'js-reporters';
import { QUnitEnv } from './env';
import { Actions } from './actions/extension';
import { LOCAL_LOGGER } from '@glimmer/util';

export async function setupQunit() {
  Reporter.init();

  let env = QUnitEnv.initGlobal();

  QUnit.config.urlConfig.push(
    {
      id: 'smoke_tests',
      label: 'Enable Smoke Tests',
      tooltip: 'Enable Smoke Tests',
    },
    {
      id: 'local-should-log',
      label: '🗒️ VM',
      tooltip: 'Log the VM state as it evaluates.',
    },
    {
      id: 'local-log-tracking',
      label: '🗒️ Tracking',
      tooltip: 'Log information about tracking frames and consumption.',
    },
    {
      id: 'local-log-step-markers',
      label: '🗒️ Step Markers',
      tooltip: 'Log step markers to the console.',
    },
    {
      id: 'ci',
      label: 'Enable CI Mode',
      tooltip: 'CI mode makes tests run faster by sacrificing UI responsiveness',
    },
    {
      id: 'todo-behavior',
      label: 'TODOs',
      tooltip: 'What to do with TODOs',
      value: {
        initial: 'Show all TODOs (default)',
        'hide-valid': 'Hide expected TODOs (still failing)',
        'show-only-invalid': 'Show only unexpected TODOs (passing)',
        ignore: 'Hide all TODOs',
      },
    }
  );

  await Promise.resolve();

  env.setupTestDOM();
  env.use(Actions);

  let ci = env.hasFlag('ci');

  if (ci) {
    let runner = autoRegister();
    let tap = QUnit.reporters.tap;
    tap.init(runner, { log: console.info });
  }

  LOCAL_LOGGER.log(`[HARNESS] ci=${env.hasFlag('ci')}`);

  let todos = env.getFlag('todo-behavior');

  if (todos) {
    let style = document.createElement('style');

    switch (todos) {
      case undefined:
      case 'initial':
        break;
      case 'hide-valid':
        style.innerHTML = `
          #qunit #qunit-tests li.pass.todo {
            display: none;
          }
        `;
        break;
      case 'show-only-invalid':
        style.innerHTML = `
          #qunit #qunit-tests li:not(.fail.todo) {
            display: none;
          }
        `;
        break;
      case 'ignore':
        style.innerHTML = `
          #qunit #qunit-tests li.todo {
            display: none;
          }
        `;
        break;
    }

    document.head.append(style);
  }

  QUnit.testStart(() => {
    debug.resetTrackingTransaction?.();
  });

  if (!env.hasFlag('ci')) {
    // since all of our tests are synchronous, the QUnit
    // UI never has a chance to rerender / update. This
    // leads to a very long "white screen" when running
    // the tests
    //
    // this adds a very small amount of async, just to allow
    // the QUnit UI to rerender once per module completed
    let pause = () =>
      new Promise<void>((res) => {
        setTimeout(res, 1);
      });

    let start = performance.now();
    QUnit.testDone(async () => {
      let gap = performance.now() - start;
      if (gap > 200) {
        await pause();
        start = performance.now();
      }
    });

    QUnit.moduleDone(pause);
  }

  if (ci) {
    QUnit.done(() => {
      LOCAL_LOGGER.log('[HARNESS] done');
    });
  }

  return {
    smokeTest: env.hasFlag('smoke_test'),
  };
}
