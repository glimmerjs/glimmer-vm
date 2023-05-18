import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import chalk, { type ChalkInstance } from 'chalk';

import { type Package, packages, type PackageJSON } from './packages.mjs';

const ERROR_MARKER = '[!]';
const PAD = ' '.repeat(ERROR_MARKER.length);

const ROLLUP_CONFIG = [
  `import { Package } from '@glimmer-workspace/build-support'`,
  `export default Package.config(import.meta)`,
]
  .map((line) => `${line};\n`)
  .join('\n');

type Update = OkUpdate | ErrUpdate;

type ErrUpdate = [type: 'err', title: string, message: string];

interface OkUpdate {
  file: string;
  operation: 'add' | 'rm' | 'update';
}
for (const pkg of packages('@glimmer')) {
  const updated: Update[] = [];
  const { updates, packageJSON } = update(pkg, updatePublic);
  updated.push(...updates);
  updated.push(...updateRollupConfig(pkg, packageJSON));

  report(pkg, updated);
}

for (const pkg of packages('@glimmer-workspace')) {
  const { updates } = update(pkg, updateUniversalScripts);
  report(pkg, updates);
}

function report(pkg: Package, updates: Update[]) {
  if (updates.length === 0) {
    reportLine('∅', chalk.gray, pkg.name);
  } else {
    const { add, rm, change, errors } = groupUpdates(updates);

    reportGroup('+', chalk.green, add, pkg);
    reportGroup('-', chalk.red, rm, pkg);
    reportGroup('~', chalk.yellow, change, pkg);

    if (errors.length > 0) {
      reportLine('!', [chalk.red, chalk.red, chalk.red], pkg.name, {
        marker: '(error)',
      });
      // console.error(chalk.red(ERROR_MARKER), chalk.red.bold(pkg.name));
      for (const error of errors) {
        console.error(`${PAD}${chalk.yellow.bold(`- ${error.title}`)}`);
        console.error(`${PAD}  ${chalk.yellow(error.message)}`);
      }
    }
  }
}

function reportGroup(op: string, color: ChalkInstance, group: string[], pkg: Package) {
  if (group.length > 0) {
    const marker = group.length > 1 ? `(${group.length})` : '';
    reportLine(op, [color, color.bold, chalk.magenta], pkg.name, {
      marker,
      message: group.join(', '),
    });
  }
}

type Color = ChalkInstance | [op: ChalkInstance, pkg: ChalkInstance, marker: ChalkInstance];

function reportLine(
  op: string,
  color: Color,
  packageName: string,
  options: {
    marker?: string;
    message?: string;
  } = {}
) {
  const [opColor, pkgColor, markerColor = chalk.magenta] = Array.isArray(color)
    ? color
    : [color, color];

  const marker = options.marker ? ` ${markerColor(options.marker)} ` : '';
  const message = options.message ? ` ${chalk.gray(options.message)}` : '';
  console.log(`${opColor(`[${op}]`)} ${pkgColor.bold(packageName)}${marker}${message}`);
}

interface ErrorMessage {
  title: string;
  message: string;
}

function groupUpdates(updates: Update[]): {
  add: string[];
  rm: string[];
  change: string[];
  errors: ErrorMessage[];
} {
  const add: string[] = [];
  const rm: string[] = [];
  const change: string[] = [];
  const errors: ErrorMessage[] = [];

  for (const update of updates) {
    if (Array.isArray(update)) {
      errors.push({ title: update[1], message: update[2] });
      continue;
    }

    switch (update.operation) {
      case 'add':
        add.push(update.file);
        break;
      case 'rm':
        rm.push(update.file);
        break;
      case 'update':
        change.push(update.file);
    }
  }

  return { add, rm, change, errors };
}

function update(
  pkg: Package,
  updater: (packageJSON: PackageJSON) => PackageJSON | ErrUpdate
): { updates: Update[]; packageJSON: PackageJSON } {
  let packageJSON: PackageJSON = JSON.parse(
    readFileSync(`${pkg.path}/package.json`, { encoding: 'utf-8' })
  );
  const original = JSON.stringify(packageJSON);

  const result = updater(packageJSON);

  if (Array.isArray(result)) {
    return { updates: [result], packageJSON };
  }

  packageJSON = result;

  if (original === JSON.stringify(packageJSON)) {
    return { updates: [], packageJSON };
  }
  writeFileSync(`${pkg.path}/package.json`, JSON.stringify(packageJSON, null, 2), {
    encoding: 'utf-8',
  });

  return { updates: [{ file: 'package.json', operation: 'update' }], packageJSON };
}

function updateRollupConfig(pkg: Package, packageJSON: PackageJSON): Update[] {
  if (packageJSON.main === 'index.d.ts') return [];

  const config = resolve(pkg.path, 'rollup.config.mjs');
  if (packageJSON.workspace?.entry) {
    if (packageJSON.private) {
      return [
        [
          'err',
          `invalid private package`,
          `entry points (workspace.entry=true) are not allowed in private packages`,
        ],
      ];
    }

    const exists = existsSync(config);

    if (exists) {
      const contents = readFileSync(config, { encoding: 'utf-8' });
      if (contents === ROLLUP_CONFIG) return [];
    }

    writeFileSync(config, ROLLUP_CONFIG, { encoding: 'utf-8' });
    return [{ file: 'rollup.config.mjs', operation: exists ? 'update' : 'add' }];
  } else if (existsSync(config)) {
    rmSync(config);
    return [{ file: 'rollup.config.mjs', operation: 'rm' }];
  }

  return [];
}

function updatePublic(packageJSON: PackageJSON) {
  if (packageJSON.workspace?.entry && packageJSON.private) {
  }

  return updateExports(updatePublicDependencies(updatePublicScripts(packageJSON)));
}

function updatePublicScripts(packageJSON: PackageJSON) {
  return updateBuildScripts(updateUniversalScripts(packageJSON));
}

function updatePublicDependencies(packageJSON: PackageJSON) {
  return {
    ...packageJSON,
    devDependencies: {
      ...packageJSON.devDependencies,
      '@glimmer-workspace/build-support': 'workspace:^',
    },
  };
}

function updateBuildScripts(packageJSON: PackageJSON) {
  if (packageJSON.main === 'index.d.ts') return packageJSON;

  return updateScripts(packageJSON, {
    build: 'rollup -c rollup.config.mjs --experimentalLogSideEffects',
  });
}

function updateExports(packageJSON: PackageJSON): PackageJSON {
  if (packageJSON.main === 'index.js' || packageJSON.main === 'index.mjs') {
    if (packageJSON.types === 'index.d.ts' || packageJSON.types === 'index.d.mts') {
      return {
        ...packageJSON,
        exports: {
          types: `./${packageJSON.types}`,
          default: `./${packageJSON.main}`,
        },
      };
    }
    return {
      ...packageJSON,
      exports: {
        default: './index.js',
      },
    };
  }

  if (packageJSON.main === 'index.d.ts') {
    return { ...packageJSON, types: 'index.d.ts', exports: { types: './index.d.ts' } };
  }

  return {
    ...packageJSON,
    main: 'index.ts',
    types: 'index.ts',
    publishConfig: {
      access: 'public',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        types: './dist/index.d.ts',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
    },
  };
}

function updateUniversalScripts(packageJSON: PackageJSON) {
  const tsconfig = packageJSON.config?.tsconfig ?? '../tsconfig.json';

  return updateScripts(packageJSON, {
    'test:lint': 'eslint .',
    'test:types': `tsc --noEmit -p ${tsconfig}`,
  });
}

function updateScripts(packageJSON: PackageJSON, updates: Record<string, string>) {
  return {
    ...packageJSON,
    scripts: {
      ...packageJSON.scripts,
      ...updates,
    },
  };
}
