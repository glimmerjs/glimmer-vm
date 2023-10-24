import { execSync } from 'node:child_process';

import chalk from 'chalk';

import { packages } from './packages.mjs';

const errors = [];

for (const pkg of packages('@glimmer')) {
  console.log(`${chalk.gray('# publishing')} ${chalk.cyanBright(pkg.name)}`);

    try {
      execSync('pnpm publish --access public --no-git-checks', {
        cwd: pkg.path,
        stdio: 'inherit',
      });
    } catch (err) {
      console.info(`Publishing ${pkg.name} has failed. A full list of errors will be printed at the end of this run`);
      errors.push(err);
      continue;
    }

    console.info(`Publishing ${pkg.name} completed successfully!`);
}

if (errors.length) {
  console.error('Errors were encountered while publishing these packages');
  errors.forEach(error => console.log(error));
  process.exit(1);
}
