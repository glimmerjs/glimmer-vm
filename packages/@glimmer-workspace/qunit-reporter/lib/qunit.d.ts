export interface ExtendedQUnit extends QUnit {
  config: QUnitConfig & Record<string, string | boolean | undefined>;

  reporters: {
    perf: {
      init: (QUnit: QUnit) => void;
    };
  };
}

export type UrlConfig = string | UrlConfigObject;

export interface UrlConfigObject {
  id: string;
  label: string;
  value?: string[] | Record<string, string>;
  tooltip?: string;
}

export interface ModuleDetails {
  name: string;
  moduleId: string;
}

export interface DropdownData {
  selectedMap: Map<string, string>;
  options: any;
  isDirty: any;
}

type Config = QUnit['config'];

interface QUnitConfig extends Config {
  queue: unknown[];
}

interface ModuleDetails {}
