import { enumerate } from './array-utils';
import { getFirst, getLast, isPresentArray } from './present';

export function strip(strings: TemplateStringsArray, ...args: unknown[]) {
  let out = '';
  for (let [index, string] of enumerate(strings)) {
    let dynamic = args[index] === undefined ? '' : String(args[index]);

    out += `${string}${dynamic}`;
  }

  let lines = out.split('\n');

  while (isPresentArray(lines) && /^\s*$/u.test(getFirst(lines))) {
    lines.shift();
  }

  while (isPresentArray(lines) && /^\s*$/u.test(getLast(lines))) {
    lines.pop();
  }

  let min = Number.POSITIVE_INFINITY;

  for (let line of lines) {
    let leading = /^\s*/u.exec(line)![0].length;

    min = Math.min(min, leading);
  }

  let stripped = [];

  for (let line of lines) {
    stripped.push(line.slice(min));
  }

  return stripped.join('\n');
}
