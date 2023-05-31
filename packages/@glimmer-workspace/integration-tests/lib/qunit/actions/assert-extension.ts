import { LOCAL_SHOULD_LOG_STEP_MARKERS } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { Action, Step } from './steps';

export function installExtensions(qunit: QUnit) {
  qunit.assert.expect = function (
    this: Assert & { test: QUnit.TestBase },
    expected?: number | string[]
  ) {
    if (typeof expected === 'number') {
      this.test.expected = expected;
    } else if (Array.isArray(expected)) {
      this.verifyActions(expected);
    } else {
      return this.test.expected;
    }
  };

  qunit.assert.action = function (this: Assert & { test: QUnit.TestBase }, rawMessage: string) {
    let action = Action.parse(rawMessage);

    this.test.steps.push(action);

    if (LOCAL_SHOULD_LOG_STEP_MARKERS) {
      LOCAL_LOGGER.log(`%caction %c${action}`, 'color: #9f9; font-weight: bold', 'color: #aa5');
    }

    this.pushResult({
      result: true,
      message: `[[action]] ${JSON.stringify(action)}`,
    });
  };

  qunit.assert.step = function (this: Assert & { test: QUnit.TestBase }, message: string) {
    let step = Step.parse(message);

    if (LOCAL_SHOULD_LOG_STEP_MARKERS) {
      LOCAL_LOGGER.log(`%cstep %c${message}`, 'color: #6cc; font-weight: bold', 'color: #aa5');
    }

    this.pushResult({
      result: true,
      expected: step,
      actual: step,
      message: `[[step]] ${JSON.stringify(step)}`,
    });
  };

  qunit.assert.verifyActions = function (
    this: Assert & { test: QUnit.TestBase },
    expectedSpecification,
    message
  ) {
    // Since the steps array is just string values, we can clone with slice
    let actualActions = [...this.test.steps];
    let expectedActions = expectedSpecification.map((spec) => Action.parse(spec));

    function getMessage() {
      let hasMissing = false;
      let hasUnexpected = false;
      if (
        expectedActions.some(
          (expectedAction) =>
            !actualActions.some((actualAction) => actualAction.matches(expectedAction))
        )
      ) {
        hasMissing = true;
      }

      if (
        actualActions.some(
          (actualAction) =>
            !expectedActions.some((expectedAction) => actualAction.matches(expectedAction))
        )
      ) {
        hasUnexpected = true;
      }

      if (hasMissing && hasUnexpected) {
        return `actions do not match expectations`;
      } else if (hasMissing) {
        return `some expected actions are missing`;
      } else if (hasUnexpected) {
        return `some unexpected actions are present`;
      } else {
        let actions = actualActions.length === 0 ? 'no actions' : actualActions.join(', ');
        return `valid actions (${actions})`;
      }
    }

    let assertionMessage = getMessage();

    if (JSON.stringify(expectedActions) === JSON.stringify(actualActions)) {
      this.pushResult({
        result: true,
        message: message ?? `[verify] ${assertionMessage}`,
        actual: actualActions,
        expected: expectedActions,
      });
    } else {
      this.pushResult({
        result: false,
        message: message ?? `[verify] ${assertionMessage}`,
        actual: actualActions,
        expected: expectedActions,
      });
    }

    this.test.steps.length = 0;
  };
}
