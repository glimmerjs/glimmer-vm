import type { Dict, Nullable, PresentArray } from '@glimmer/interfaces';
import type { Operand, OperandList } from './utils';

export type ShouldCheckOpcode = { type: 'checked' } | { type: 'unchecked'; reason: string };

export interface NormalizedMetadata {
  name: string;
  mnemonic: string;
  before: null;
  stack: StackSpec;
  stackChange: Nullable<number>;
  ops: OperandList;
  operands: number;
  check: ShouldCheckOpcode;
}

export type Stack = [string[], string[]];

export interface RawOperandMetadata {
  kind: 'machine' | 'syscall';
  format: RawOperandFormat;
  skip?: true;
  operation: string;
  'operand-stack'?: [string[], string[]];
  notes?: string;
}

export type OperandName = `${string}:${string}`;
export type RawOperandFormat = OperandName | PresentArray<OperandName>;

function stackChange(stack?: Stack): Nullable<number> {
  if (stack === undefined) {
    return 0;
  }

  let before = stack[0];
  let after = stack[1];

  if (hasRest(before) || hasRest(after)) {
    return null;
  }

  return after.length - before.length;
}

function hasRest(input: string[]): boolean {
  if (!Array.isArray(input)) {
    throw new Error(`Unexpected stack entry: ${JSON.stringify(input)}`);
  }
  return input.some((s) => s.slice(-3) === '...');
}

export interface NormalizedOpcodes {
  readonly machine: Dict<NormalizedMetadata>;
  readonly syscall: Dict<NormalizedMetadata>;
}

export function strip(strings: TemplateStringsArray, ...args: unknown[]) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    let string = strings[i];
    let dynamic = args[i] !== undefined ? String(args[i]) : '';

    out += `${string}${dynamic}`;
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  out = /^\s*?\n?([\s\S]*?)\s*$/u.exec(out)![1] as string;

  let min = 9007199254740991; // Number.MAX_SAFE_INTEGER isn't available on IE11

  for (let line of out.split('\n')) {
    let leading = /^\s*/u.exec(line)![0].length;

    min = Math.min(min, leading);
  }

  let stripped = '';

  for (let line of out.split('\n')) {
    stripped += line.slice(min) + '\n';
  }

  return stripped;
}

export const META_KIND = ['METADATA', 'MACHINE_METADATA'];
export type META_KIND = (typeof META_KIND)[number];

export function buildSingleMeta<D extends Dict<NormalizedMetadata>>(
  kind: META_KIND,
  all: D,
  key: keyof D
): string {
  let e = kind === 'MACHINE_METADATA' ? 'MachineOp' : 'Op';
  return `${kind}[${e}.${all[key]!.name}] = ${stringify(all[key], 0)};`;
}

function stringify(o: unknown, pad: number): string {
  if (typeof o !== 'object' || o === null) {
    if (typeof o === 'string') {
      return `'${o}'`;
    }
    return JSON.stringify(o);
  }

  if (Array.isArray(o)) {
    return `[${o.map((v) => stringify(v, pad)).join(', ')}]`;
  }

  let out = ['{'];

  for (let key of Object.keys(o)) {
    out.push(`${' '.repeat(pad + 2)}${key}: ${stringify((o as Dict)[key], pad + 2)},`);
  }

  out.push(`${' '.repeat(pad)}}`);

  return out.join('\n');
}

export function buildMetas(kind: META_KIND, all: Dict<NormalizedMetadata>): string {
  let out = [];

  for (let key of Object.keys(all)) {
    out.push(buildSingleMeta(kind, all, key));
  }

  return out.join('\n\n');
}
function op(value: `${string}:${string}`, index: number, array: `${string}:${string}`[]): Operand {
  throw new Error('Function not implemented.');
}
