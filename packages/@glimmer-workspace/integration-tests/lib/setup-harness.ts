/* eslint-disable no-console */
import { debug } from '@glimmer/validator';
import { autoRegister } from 'js-reporters';

export async function setupQunit() {
  await import('qunit/qunit/qunit.css');

  QUnit.config.urlConfig.push(
    {
      id: 'smoke_tests',
      label: 'Enable Smoke Tests',
      tooltip: 'Enable Smoke Tests',
    },
    {
      id: 'local-should-log',
      label: 'Enable Local Logging',
      tooltip:
        'Local logging is internal logs that are only ever used when developing Glimmer itself',
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
        'hide-valid': 'Hide failing TODOs',
        'show-only-invalid': 'Show only passing TODOs',
        ignore: 'Hide all TODOs',
      },
    }
  );

  await Promise.resolve();

  let qunitDiv = document.createElement('div');
  qunitDiv.id = 'qunit';
  let qunitFixtureDiv = document.createElement('div');
  qunitFixtureDiv.id = 'qunit-fixture';

  document.body.append(qunitDiv, qunitFixtureDiv);

  let ci = hasFlag('ci');

  if (ci) {
    let runner = autoRegister();
    let tap = QUnit.reporters.tap;
    tap.init(runner, { log: console.info });
  }

  console.log(`[HARNESS] ci=${hasFlag('ci')}`);

  let todos = getFlag('todo-behavior');

  if (todos) {
    let style = document.createElement('style');

    switch (todos) {
      case undefined:
      case 'initial':
        break;
      case 'hide-valid':
        style.innerHTML = `
          #qunit-tests li.pass.todo {
            display: none;
          }
        `;
        break;
      case 'show-only-invalid':
        style.innerHTML = `
          #qunit-tests li:not(.fail.todo) {
            display: none;
          }
        `;
        break;
      case 'ignore':
        style.innerHTML = `
          #qunit-tests li.todo {
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

  if (!hasFlag('ci')) {
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
      console.log('[HARNESS] done');
    });
  }

  return {
    smokeTest: hasFlag('smoke_test'),
  };
}

function hasFlag(flag: string): boolean {
  let location = typeof window !== 'undefined' && window.location;
  return location && new RegExp(`[?&]${flag}`).test(location.search);
}

function getFlag(flag: string): string | null {
  return new URL(location.href).searchParams.get(flag);
}
