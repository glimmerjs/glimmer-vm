import type { DebugVmState, Dict, PresentArray } from '@glimmer/interfaces';
import type { OperandList, Op, ShorthandStackReturn } from './utils';
import type { UNCHANGED } from './stack/params';

export type StackCheck = DynamicStackFn | { type: 'unchecked'; reason: string };

export interface NormalizedMetadata {
  name: string;
  mnemonic: string;
  before: null;
  stackCheck: StackCheck;
  ops: OperandList;
  operands: number;
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

/**
 * Takes an operand and dynamically computes the stack change.
 *
 * If the function returns a number, that number is used as the stack change
 * (and stack parameters are ignored).
 *
 * If the return value is an array:
 *
 * - If the first value is `UNCHANGED`, the stack change is the length of the
 *   return values after `UNCHANGED`.
 * - Otherwise, the stack change is the length of the return values minus
 *   the length of the parameters.
 */
export type DynamicStackFnSpec = (
  op: Op,
  state: DebugVmState
) => [typeof UNCHANGED, ...ShorthandStackReturn[]] | ShorthandStackReturn[] | number;
export type DynamicStackFn = (op: Op, state: DebugVmState) => number;
