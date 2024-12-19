export interface ScenarioConfig {
  /**
   * - false: do not run
   * - 'repeat': reuse the scenario directory and run again without
   *   rebuilding or resetting any directories
   * - 'rebuild': reuse the scenario directory and run again, but reset
   *   the benchmark directory, and run `pnpm install` and `pnpm
   *   build` again
   * - 'reset' (default): delete the scenario directory and start from scratch
   */
  run: false | 'repeat' | 'rebuild' | 'reset';
  /**
   * If `serve` is `false`, the scenario is set up but not served
   */
  serve: boolean;
  ref: string;
  port: number;
}

export interface Config extends WorkspaceOptions {
  workspaceRoot: string;
  control: ScenarioConfig;
  experiment: ScenarioConfig;
  offline: boolean;
  tmpdir: string;
}

export interface WorkspaceOptions {
  workspaceRoot: string;
}
