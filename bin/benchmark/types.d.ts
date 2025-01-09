export type BuildMode = 'off' | 'repeat' | 'rebuild' | 'reset';
export type ServeMode = 'off' | 'serve' | 'bench';

export interface ScenarioConfig {
  /**
   * - 'none': do not run
   * - 'repeat': reuse the scenario directory and run again without
   *   rebuilding or resetting any directories
   * - 'rebuild': reuse the scenario directory and run again, but reset
   *   the benchmark directory, and run `pnpm install` and `pnpm
   *   build` again
   * - 'reset' (default): delete the scenario directory and start from scratch
   */
  build: BuildMode;
  /**
   * If `serve` is `false`, the scenario is set up but not served
   */
  serve: ServeMode;
  ref: string;
  port: number;
}

export interface Config extends WorkspaceOptions {
  workspaceRoot: string;
  control: ScenarioConfig;
  experiment: ScenarioConfig;
  offline: boolean;
  loglevel: {
    shouldTrace: boolean;
    shouldDebug: boolean;
  };
  tmpdir: string;
  env: {
    markers: string[];
    fidelity: string;
    throttleRate: string;
  };
}

export interface WorkspaceOptions {
  workspaceRoot: string;
}
