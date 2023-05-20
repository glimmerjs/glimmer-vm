import { EnvironmentImpl } from '@glimmer/runtime';
import { castToSimple } from '@glimmer/util';

QUnit.module('[integration] env');

QUnit.test('assert against nested transactions', (assert) => {
  let environment = new EnvironmentImpl(
    { document: castToSimple(document) },
    {
      onTransactionCommit() {},
      isInteractive: true,
      enableDebugTooling: false,
    }
  );
  environment.begin();
  assert.throws(
    () => environment.begin(),
    'A glimmer transaction was begun, but one already exists. You may have a nested transaction, possibly caused by an earlier runtime exception while rendering. Please check your console for the stack trace of any prior exceptions.'
  );
});

QUnit.test('ensure commit cleans up when it can', (assert) => {
  let environment = new EnvironmentImpl(
    { document: castToSimple(document) },
    {
      onTransactionCommit() {},
      isInteractive: true,
      enableDebugTooling: false,
    }
  );
  environment.begin();

  // ghetto stub
  Object.defineProperty(environment, 'transaction', {
    get() {
      return {
        scheduledInstallManagers(): void {},
        commit(): void {
          throw new Error('something failed');
        },
      };
    },
  });

  assert.throws(() => environment.commit(), 'something failed'); // commit failed

  // but a previous commit failing, does not cause a future transaction to fail to start
  environment.begin();
});
