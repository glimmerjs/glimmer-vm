const shell = require('shelljs');
const path = require('path');

const formatters = path.resolve(__dirname, '..', '.vscode', 'tslint-formatters');

shell.exec('tsc -p tsconfig.json --noEmit');
shell.exec(`tslint -p . --formatters-dir ${formatters} --format tsc`);
