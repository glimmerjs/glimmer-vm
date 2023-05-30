import { unwrap } from '@glimmer/util';

export class Reporter {
  static init(delegate = new GlimmerReporter()): Reporter {
    return new Reporter(QUnit, delegate);
  }

  readonly #delegate: ReporterDelegate;
  #lastTest: TestReport | null = null;

  constructor(qunit: QUnit, delegate: ReporterDelegate) {
    this.#delegate = delegate;

    QUnit.on('assertion', (assertion) => {
      this.#assertion(assertion);
    });

    QUnit.on('error', (error) => {
      this.#error(error);
    });

    QUnit.on('suiteStart', (suite) => {
      this.#suiteStart(suite);
    });

    QUnit.on('suiteEnd', (suite) => {
      this.#suiteEnd(suite);
    });

    QUnit.on('testStart', (test) => {
      this.#testStart(test);
    });

    QUnit.on('testEnd', (test) => {
      this.#testEnd(test);
    });

    QUnit.testDone((details) => {
      this.#nonstandardTestDone(details);
    });
  }

  #assertion(assertion: AssertionReport) {
    return assertion.passed
      ? this.#delegate.passed?.(assertion)
      : this.#delegate.failed?.(assertion);
  }

  #error(error: unknown) {
    return error instanceof Error
      ? this.#delegate.error?.(error)
      : this.#delegate.unknownError?.(error);
  }

  #suiteStart(suite: SuiteDetails) {
    return this.#delegate.suiteStart?.(suite);
  }

  #suiteEnd(suite: SuiteReport) {
    switch (suite.status) {
      case 'passed':
        return this.#delegate.suitePassed?.(suite, false);
      case 'failed':
        return this.#delegate.suiteFailed?.(suite, false);
      case 'skipped':
        return this.#delegate.suiteSkipped?.(suite);
      case 'todo':
      // TODO: :laughing:
      // return suite.errors.length > 0 ? this.#delegate.suiteFailed?.(suite, true) : this.#delegate.suitePassed?.(suite, true);
    }
  }

  #testStart(test: TestDetails) {
    return this.#delegate.testStart?.(test);
  }

  #testEnd(test: TestReport) {
    this.#lastTest = test;
  }

  #nonstandardTestDone(details: TestDoneDetails) {
    let lastTest = unwrap(this.#lastTest);

    let fullDetails = new TestDoneReport(details.testId, lastTest);
    this.#lastTest = null;

    switch (lastTest.status) {
      case 'passed':
        return this.#delegate.testPassed?.(fullDetails, false);
      case 'failed':
        return this.#delegate.testFailed?.(fullDetails, false);
      case 'skipped':
        return this.#delegate.testSkipped?.(fullDetails);
      case 'todo':
        return lastTest.errors.length > 0
          ? this.#delegate.testFailed?.(fullDetails, true)
          : this.#delegate.testPassed?.(fullDetails, true);
    }
  }
}

interface ReporterDelegate {
  passed?(assertion: AssertionReport): void;
  failed?(assertion: AssertionReport): void;
  error?(error: Error): void;
  unknownError?(error: unknown): void;

  suiteStart?(suite: SuiteDetails): void;
  suitePassed?(suite: SuiteReport, todo: boolean): void;
  suiteFailed?(suite: SuiteReport, todo: boolean): void;
  suiteSkipped?(suite: SuiteReport): void;

  testStart?(test: TestDetails): void;
  testPassed?(suite: TestDoneReport, todo: boolean): void;
  testFailed?(suite: TestDoneReport, todo: boolean): void;
  testSkipped?(suite: TestDoneReport): void;
}

export class GlimmerReporter implements ReporterDelegate {
  passed(assertion: AssertionReport) {
    // console.debug('[GLIMMER] assertion ok', assertion);
  }

  failed(assertion: AssertionReport) {
    // console.error('[GLIMMER] assertion fail', assertion);
  }

  testStart(test: TestDetails): void {
    // console.warn('[GLIMMER] test start', test);
  }

  testFailed(test: TestDoneReport, todo: boolean) {
    // console.error('[GLIMMER] test failed', todo ? '(todo)' : '', test);
    // console.log(test.element);
  }
}

class TestDoneReport implements TestReport {
  readonly testId: string;
  readonly suiteName: string;
  readonly runtime: number;
  readonly assertions: AssertionReport[];
  readonly errors: AssertionReport[];
  readonly status: Status;
  readonly name: string;
  readonly fullName: string[];

  constructor(testId: string, details: TestReport) {
    this.testId = testId;
    this.suiteName = details.suiteName;
    this.runtime = details.runtime;
    this.assertions = details.assertions;
    this.errors = details.errors;
    this.status = details.status;
    this.name = details.name;
    this.fullName = details.fullName;
  }

  get element(): TestElement {
    let element = unwrap(
      document.querySelector(`#qunit-test-output-${this.testId}`)
    ) as HTMLLIElement;
    return new TestElement(element, this);
  }
}

/**
 * A `TestElement` is an <li id="qunit-test-output-<id>"> element that contains
 * the test output.
 */
class TestElement {
  readonly element: HTMLLIElement;
  readonly #test: TestDoneReport;

  constructor(element: HTMLLIElement, test: TestDoneReport) {
    this.element = element;
    this.#test = test;
  }

  get todoLabel(): HTMLElement | null {
    return this.element.querySelector('.qunit-todo-label');
  }
}
