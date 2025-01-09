import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globby } from 'globby';

const currentDir = fileURLToPath(import.meta.url);
const FORBIDDEN = [
  /**
   * import.meta.env is not a platform standard
   */
  'import.meta.env',
  /**
   * These variables are wrapped around code for this repo only
   */
  'VM_LOCAL',
  /**
   * These are for local VM debugging and development, and are not meant to make it to real code
   */
  /[^.]check\(/u,
  'CheckInterface',
  'CheckOr',
  'CheckFunction',
  'CheckObject',

  '@glimmer/debug',
  '@glimmer/constants',
  '@glimmer/debug-util',
];

const IGNORED_DIRS = [`@glimmer/debug`, `@glimmer/constants`, `@glimmer/debug-util`];

let files = await globby(resolve(currentDir, '../../packages/**/dist/**/index.js'), {
  ignore: ['node_modules', '**/node_modules'],
});

files = files.filter((file) => !IGNORED_DIRS.some((dir) => file.includes(dir)));

let errors = [];

console.log(`Found ${files.length} files to check...`);

for (let filePath of files) {
  console.log(`Checking ${filePath}...`);
  let file = await readFile(filePath);
  let content = file.toString();

  for (let searchFor of FORBIDDEN) {
    if (typeof searchFor === 'string' ? content.includes(searchFor) : searchFor.test(content)) {
      errors.push({ filePath, found: searchFor });
    }
  }
}

if (errors.length > 0) {
  console.error(errors);
  throw new Error(`The forbidden texts were encountered in the above files`);
}

console.info('No forbidden texts!');
