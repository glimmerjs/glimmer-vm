export interface ExtendedQUnit extends QUnit {
  config: QUnitConfig & Record<string, string | boolean | undefined>;

  diff: (expected: string, actual: string) => string;

  testDone: (callback: (details: TestDoneDetails) => void | Promise<void>) => void;

  on: QUnitOn;

  reporters: {
    perf: {
      init: (QUnit: QUnit) => void;
    };
  };
}

interface QUnitOn {
  (event: 'runStart', callback: (details: RunStartDetails) => void): void;
  (event: 'runEnd', callback: (details: RunEndDetails) => void): void;
  (event: 'error', callback: (error: unknown | Error) => void): void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace QUnit {
    interface TestStartDetails {
      testId: string;
      previousFailure: boolean;
    }

    interface LogDetails {
      testId: string;
      negative: boolean;
    }
  }
}

export type UrlConfig = Config['urlConfig'];

export interface UrlConfigObject {
  id: string;
  label: string;
  value?: string[] | Record<string, string>;
  tooltip?: string;
}

export interface RunStartDetails {
  testCounts: {
    total: number;
  };
}

export interface RunEndDetails {
  runtime: number;
  status: 'passed' | 'failed';
  testCounts: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
  };
}

export interface AssertionDetails {
  result: boolean;
  message: string;
}

export interface TestDoneDetails {
  name: string;
  module: string;
  testId: string;
  failed: number;
  passed: number;
  todo: number;
  skipped: number;
  assertions: AssertionDetails[];
  total: number;
  runtime: number;
  source: string | undefined;
}

export interface ModuleDetails {
  name: string;
  moduleId: string;
}

export interface DropdownData {
  selectedMap: Map<string, string>;
  options: ModuleDetails[];
  isDirty: () => boolean;
}

type Config = QUnit['config'];

interface QUnitConfig extends Config {
  queue: unknown[];
  stats: {
    all: number;
    bad: number;
    testCount: number;
  };
}
