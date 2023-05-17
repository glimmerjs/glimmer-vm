import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Package {
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly private: boolean;
  readonly packageJSON: PackageJSON;
}

export function packages(namespace: string): Package[] {
  const parsed = JSON.parse(
    execSync(`pnpm ls -r --depth -1 --filter "${namespace}/*" --json`, {
      encoding: 'utf-8',
    })
  ) as Package[];

  return parsed.map((p) => ({
    ...p,
    get packageJSON() {
      return JSON.parse(readFileSync(resolve(p.path, 'package.json'), { encoding: 'utf-8' }));
    },
  }));
}

export interface PackageJSON extends Record<string, unknown> {
  name?: string | undefined;
  main?: string | undefined;
  types?: string | undefined;
  private?: boolean;
  scripts?: Record<string, string> | undefined;
  devDependencies?: Record<string, string> | undefined;
  config?:
    | {
        tsconfig?: string | undefined;
      }
    | undefined;
  workspace?: {
    entry?: boolean;
  };
}
