import chalk from 'chalk';
import { execa } from 'execa';
import { rimraf } from 'rimraf';
import { packages } from './packages.mjs';

for (const pkg of packages('@glimmer')) {
  try {
    await execa('pnpm', ['uninstall', '--global', pkg.name]);

    console.log(chalk.green(`Successfully unlinked ${pkg.name}`));
  } catch (error: unknown) {
    let message = `Failed to unlink ${pkg.name}`;

    if (error instanceof Error) {
      message += `\n\n${error.stack}`;
    }

    throw new Error(message);
  }
}

const dist = new URL('../dist', import.meta.url).pathname;
await rimraf(dist);
