import { join } from 'node:path';
import { execa } from 'execa';
import { packages } from './packages.mjs';
import chalk from 'chalk';

import { previewPublish } from './preview-publish.mjs';

const dist = new URL('../dist', import.meta.url).pathname;
const pkgs = packages('@glimmer');

await previewPublish();

// Seems like there are race conditions in pnpm if we try to do these concurrently
for (const pkg of pkgs) {
  try {
    const pkgDest = join(dist, pkg.name);

    await execa('pnpm', ['link', '--global'], {
      cwd: pkgDest,
    });

    console.log(chalk.green(`Successfully linked ${pkg.name}`));
  } catch (error: unknown) {
    let message = `Failed to link ${pkg.name}`;

    if (error instanceof Error) {
      message += `\n\n${error.stack}`;
    }

    throw new Error(message);
  }
}
