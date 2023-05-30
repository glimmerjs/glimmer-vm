import { LOCAL_SHOULD_LOG_STEP_MARKERS } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';

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
    let msg = rawMessage.split(/:\s*/u);
    let type = msg.length > 1 ? msg[0] : undefined;
    let message = msg.length > 1 ? msg.slice(1).join(':') : rawMessage;

    let assertionMessage = type ? `[${type}] ${message}` : message;
    let result = !!message;

    this.test.steps.push(rawMessage);

    if (message === undefined || message === '') {
      assertionMessage = 'You must provide a message to assert.action';
    } else if (typeof message !== 'string') {
      assertionMessage = 'You must provide a string value to assert.action';
      result = false;
    }

    if (LOCAL_SHOULD_LOG_STEP_MARKERS) {
      LOCAL_LOGGER.log(`%caction %c${message}`, 'color: #9f9; font-weight: bold', 'color: #aa5');
    }

    this.pushResult({
      result,
      message: `[action] ${assertionMessage}`,
    });
  };

  qunit.assert.step = function (this: Assert & { test: QUnit.TestBase }, message: string) {
    let result = !!message;

    if (message === undefined || message === '') {
      message = 'You must provide a message to assert.step';
    } else if (typeof message !== 'string') {
      message = 'You must provide a string value to assert.step';
      result = false;
    }

    if (LOCAL_SHOULD_LOG_STEP_MARKERS) {
      LOCAL_LOGGER.log(`%cstep %c${message}`, 'color: #6cc; font-weight: bold', 'color: #aa5');
    }

    this.pushResult({
      result,
      message: `[step] ${message}`,
    });
  };

  qunit.assert.verifyActions = function (
    this: Assert & { test: QUnit.TestBase },
    expectedSteps,
    message
  ) {
    // Since the steps array is just string values, we can clone with slice
    let actualStepsClone = [...this.test.steps];

    function getMessage() {
      let hasMissing = false;
      let hasUnexpected = false;
      if (expectedSteps.some((step) => !actualStepsClone.includes(step))) {
        hasMissing = true;
      }

      if (actualStepsClone.some((step) => !expectedSteps.includes(step))) {
        hasUnexpected = true;
      }

      if (hasMissing && hasUnexpected) {
        return `actions do not match expectations`;
      } else if (hasMissing) {
        return `some expected actions are missing`;
      } else if (hasUnexpected) {
        return `some unexpected actions are present`;
      } else {
        let actions = actualStepsClone.length === 0 ? 'no actions' : actualStepsClone.join(', ');
        return `valid actions (${actions})`;
      }
    }

    let assertionMessage = getMessage();

    if (JSON.stringify(expectedSteps) === JSON.stringify(actualStepsClone)) {
      this.pushResult({
        result: true,
        message: message ?? `[verify] ${assertionMessage}`,
        actual: actualStepsClone.map((step) => `[step: ${step}]`),
        expected: expectedSteps.map((step) => `[step: ${step}]`),
      });
    } else {
      this.pushResult({
        result: false,
        message: message ?? `[verify] ${assertionMessage}`,
        actual: actualStepsClone.map((step) => `[step: ${step}]`),
        expected: expectedSteps.map((step) => `[step: ${step}]`),
      });
    }

    this.test.steps.length = 0;
  };
}
