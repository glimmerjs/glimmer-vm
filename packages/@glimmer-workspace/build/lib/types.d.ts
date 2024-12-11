import type * as rollup from 'rollup';
import type * as vite from 'vite';

export interface PackageInfo {
  readonly name: string;
  readonly root: string;
  readonly exports: string;
}

export type JsonArray = JsonValue[];
export type JsonObject = Record<string, JsonValue>;

export type JsonValue = string | number | boolean | null | JsonArray | { [key: string]: JsonValue };

export type PackageJsonInline = string | [ExternalOperator, string];

export interface PackageJSON {
  readonly exports: string;
  readonly publishConfig: {
    'glimmer:externals'?: ExternalOption[];
  };
  readonly types: string;
  readonly private: boolean;
  readonly name: string;
}

type SimpleExternal = { [P in string]: 'inline' | 'external' };
type ExternalOperator = 'startsWith' | 'is';

export type ExternalOption =
  | SimpleExternal
  | [ExternalOperator, SimpleExternal]
  | [ExternalOperator, string[], 'inline' | 'external'];

export type RollupExport = rollup.RollupOptions | rollup.RollupOptions[];
export type ViteConfig = Pick<vite.UserConfig, 'plugins' | 'esbuild' | 'optimizeDeps' | 'build'>;

export class Package {
  static root(meta: ImportMeta): string;
  static at(meta: ImportMeta | string): Package | undefined;
  static config(meta: ImportMeta | string): RollupExport;
  static viteConfig(meta: ImportMeta | string): ViteConfig;

  readonly entry: Record<string, string>;

  config(): RollupExport;
}
