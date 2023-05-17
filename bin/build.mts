import { execSync } from 'node:child_process';
import { packages } from './packages.mjs';

const pkgname = process.argv[2];
const extraArgs = process.argv.slice(3);

const filterFlags = pkgname
  ? `-F ${pkgname}`
  : packages('@glimmer')
      .filter((pkg) => pkg.packageJSON.workspace?.entry)
      .map((p) => `-F ${p.name}`)
      .join(' ');

execSync(
  `FORCE_COLOR=1 dotenv -c production -- turbo build ${filterFlags} --log-prefix none ${extraArgs.join(
    ' '
  )}`,
  {
    stdio: 'inherit',
  }
);
