#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;
const chalk = require('chalk');
const readline = require('readline');
const semver = require('semver');
const autoDistTag = require('auto-dist-tag');
const Project = require('../build/utils/project');

const DIST_PATH = path.resolve(__dirname, '../dist');
const PACKAGES_PATH = path.resolve(__dirname, '../packages');

const DRY_RUN = process.argv.indexOf('--dry-run') > -1;
if (DRY_RUN) {
  console.log(chalk.yellow("--dry-run"), "- side effects disabled");
}

// Fail fast if we haven't done a build first.
assertDistExists();
assertGitIsClean();
assertPassesSmokeTest();

let cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load up the built packages in dist.
let packages = Project.from(DIST_PATH)
  .packages
  .filter(pkg => pkg.isPublishable);

let packageNames = packages.map(pkg => pkg.name);
let newVersion;

// Begin interactive CLI
printExistingVersions();
promptForVersion()
  .finally(() => cli.close())
  .catch(reason => {
    console.error(reason);
    process.exit(1);
  });

function question(prompt) {
  return new Promise(resolve => {
    cli.question(prompt, resolve);
  });
}

function printExistingVersions() {
  let packageVersions = packages.map(pkg => [pkg.name, pkg.version]);
  printPadded(packageVersions);
}

async function promptForVersion() {
  let defaultVersion = generateDefaultVersion();

  let version = await question(chalk.green(`\nNew version to publish? [${defaultVersion}] `));
  version = version.trim();
  if (version === '') {
    version = defaultVersion;
  }

  await validateNewVersion(version);
  console.log(chalk.green(`Publishing v${version}...`));

  newVersion = version;
  await applyNewVersion();
  await gitCommitAndTag();
  await confirmPublish();
}

function generateDefaultVersion() {
  let currentVersion = require('../package.json').version;
  return semver.inc(currentVersion, 'patch');
}

function validateNewVersion(version) {
  if (version === '') { fatalError("Version must not be empty."); }
  if (!semver.valid(version)) { fatalError("Version must be a valid SemVer version."); }

  packages.forEach(pkg => {
    if (!semver.gt(version, pkg.version)) {
      fatalError(`Version must be greater than existing versions. ${pkg.name} has version ${pkg.version}, which is greater than or equal to ${version}.`);
    }
  });
}

function applyNewVersion() {
  console.log(`Apply ${newVersion}`);

  // Update root package.json
  let rootPkgPath = path.join(__dirname, '../package.json');
  let rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  let rootSimpleHTMLTokenizerVersion = rootPkg.dependencies['simple-html-tokenizer'];

  // Update packages in the dist directory
  packages.forEach(pkg => {
    pkg.pkg.version = newVersion;
    pkg.updateDependencies(newVersion);
    pkg.updateSimpleHTMLTokenizer(rootSimpleHTMLTokenizerVersion);

    if (!DRY_RUN) {
      pkg.savePackageJSON();
    }
  });

  // Update source packages
  Project.from(PACKAGES_PATH)
    .packages
    .forEach(pkg => {
      pkg.pkg.version = newVersion;
      pkg.updateDependencies(newVersion);
      pkg.updateSimpleHTMLTokenizer(rootSimpleHTMLTokenizerVersion);

      if (!DRY_RUN) {
        pkg.savePackageJSON();
      }
      execWithSideEffects(`git add "${pkg.packageJSONPath}"`);
    });

  rootPkg.version = newVersion;
  if (!DRY_RUN) {
    fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2));
      execWithSideEffects(`git add package.json`);
  }
}

function gitCommitAndTag() {
  execWithSideEffects(`git commit -m "Release v${newVersion}"`);
  execWithSideEffects(`git tag "v${newVersion}"`);
}

async function getOTPToken() {
  let token = await question(chalk.green('\nPlease provide OTP token '));

  return token.trim();
}

function publishPackage(distTag, otp, cwd) {
  execWithSideEffects(`npm publish --tag ${distTag} --access public --otp ${otp}`, {
    cwd
  });
}

async function confirmPublish() {
  console.log(chalk.blue("Version"), newVersion);

  let answer = await question(chalk.bgRed.white.bold("Are you sure? [Y/N]") + " ");

  if (answer !== 'y' && answer !== 'Y') {
    console.log(chalk.red("Aborting"));
    return;
  }

  let otp = await getOTPToken();

  let publicPackages = packages.filter(pkg => !pkg.private);
  for (let pkg of publicPackages) {
    let distTag = await autoDistTag(pkg.absolutePath);

    try {
      publishPackage(distTag, otp, pkg.absolutePath);
    } catch(e) {
      // the token is outdated, we need another one
      if (e.message.includes('E401')) {
        otp = await getOTPToken();

        publishPackage(distTag, otp, pkg.absolutePath);
      } else {
        throw e;
      }
    }
  }

  execWithSideEffects(`git push origin master --tags`);

  console.log(chalk.green(`\nv${newVersion} deployed!`));
  console.log(chalk.green('Done.'));
}

function fatalError(message) {
  console.log(chalk.red(message));
  process.exit(1);
}

function throwNoPackagesErr() {
  console.log(chalk.red('No dist directory found. Did you do a build first? (npm run build)'))
  process.exit(1);
}

function assertDistExists() {
  try {
    let stat = fs.statSync(DIST_PATH);
    if (!stat.isDirectory()) {
      throwNoPackagesErr()
    }
  } catch (e) {
    throwNoPackagesErr();
  }
}

function assertGitIsClean() {
  let status = execSync('git status').toString();
  let force = process.argv.indexOf('--force') > -1;

  if (!status.match(/^nothing to commit/m)) {
    if (force) {
      console.log(chalk.yellow("--force"), "- ignoring unclean git working tree");
    } else {
      console.log(chalk.red("Git working tree isn't clean. Use --force to ignore this warning."));
      process.exit(1);
    }
  }
}

function assertPassesSmokeTest() {
  try {
    execSync('./bin/run-types-tests.js');
  } catch (err) {
    console.log(chalk.red("Types smoke test failed: "));
    console.log(err.stdout.toString());

    process.exit(1);
  }
}

function execWithSideEffects(cmd, options) {
  let cwd = '';
  if (options && options.cwd) {
    cwd = chalk.gray.dim(` (cwd: ${options.cwd}`);
  }

  console.log(chalk.green('>') + ' ' + chalk.gray(cmd) + cwd);
  if (!DRY_RUN) {
    return execSync.apply(null, arguments);
  }
}

function printPadded(table) {
  let maxWidth = Math.max(...table.map(r => r[0].length));
  table.forEach(row => {
    console.log(chalk.blue(pad(row[0], maxWidth)) + "  " + row[1]);
  })
}

function pad(string, width) {
  return string + " ".repeat(width - string.length);
}
