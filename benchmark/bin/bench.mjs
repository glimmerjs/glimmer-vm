// @ts-check

import analyze from '@ember-performance-monitoring/tracerbench-compare-action';
import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const root = resolve(__dirname, '..');

const config = await readFile(resolve(root, 'tracerbench.json'), 'utf8');

analyze(JSON.parse(config));
