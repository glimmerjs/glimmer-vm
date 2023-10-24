import { execaCommand } from 'execa';

import chalk from 'chalk';

import { packages } from './packages.mjs';

const errors: any[] = [];

for (const pkg of packages('@glimmer')) {
  console.log(`${chalk.gray('# publishing')} ${chalk.cyanBright(pkg.name)}`);

    try {
      await execaCommand('pnpm publish --access public --no-git-checks', {
        cwd: pkg.path,
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
  errors.forEach(error => console.error(error.stderr ?? error));
  process.exit(1);
}
