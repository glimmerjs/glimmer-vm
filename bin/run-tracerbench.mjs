// @ts-nocheck
import analyze from '@tracerbench/tracerbench-compare-action';
import fs from 'node:fs/promises';
import path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const root = path.resolve(__dirname, '..');

const configFile = await fs.readFile(path.resolve(root, 'bin/tracerbench-config.json'));
const config = JSON.parse(configFile);

analyze(config);
