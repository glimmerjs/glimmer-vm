import type { Dict, Nullable, PresentArray } from '@glimmer/interfaces';

import type { ShorthandOperand, ShorthandOperandList } from './dism/operand-types';

// TODO: How do these map onto constant and machine types?
export const OPERAND_TYPES = [
  'u32',
  'i32',
  'owner',
  'handle',
  'str',
  'option-str',
  'array',
  'str-array',
  'bool',
  'primitive',
  'register',
  'unknown',
  'symbol-table',
  'scope',
];

export type OperandType = (typeof OPERAND_TYPES)[number];

export interface Operand {
  type: OperandType;
  name: string;
}

export interface NormalizedMetadata {
  name: string;
  mnemonic: string;
  stackChange: Nullable<number>;
  /** @default [] */
  ops?: ShorthandOperandList;
  /** @default true */
  check?: boolean;
}

export type Stack = [string[], string[]];

export interface RawOperandMetadata {
  kind: 'machine' | 'syscall';
  format: ShorthandOperandList;
  skip?: true;
  operation: string;
  'operand-stack'?: [string[], string[]];
  notes?: string;
}

export type OperandName = `${string}:${string}`;
export type RawOperandFormat = OperandName | PresentArray<OperandName>;

export function normalize(key: string, input: RawOperandMetadata): NormalizedMetadata {
  let name: ShorthandOperand;

  if (Array.isArray(input.format)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    name = input.format[0]!;
  } else {
    name = input.format;
  }

  return {
    name,
    mnemonic: key,
    stackChange: stackChange(input['operand-stack']),
    ops: input.format,
    check: input.skip === true ? false : true,
  };
}

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

export function normalizeAll(parsed: {
  machine: Dict<RawOperandMetadata>;
  syscall: Dict<RawOperandMetadata>;
}): NormalizedOpcodes {
  let machine = normalizeParsed(parsed.machine);
  let syscall = normalizeParsed(parsed.syscall);

  return { machine, syscall };
}

export function normalizeParsed(parsed: Dict<RawOperandMetadata>): Dict<NormalizedMetadata> {
  let out = Object.create(null) as Dict<NormalizedMetadata>;

  for (const [key, value] of Object.entries(parsed)) {
    out[key] = normalize(key, value);
  }

  return out;
}

export function buildEnum(
  name: string,
  parsed: Dict<NormalizedMetadata>,
  offset: number,
  max?: number
): { enumString: string; predicate: string } {
  let e = [`export enum ${name} {`];

  let last: number;

  Object.values(parsed).forEach((value, i) => {
    e.push(`  ${value.name} = ${offset + i},`);
    last = i;
  });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
  e.push(`  Size = ${last! + offset + 1},`);
  e.push('}');

  let enumString = e.join('\n');

  let predicate;

  if (max) {
    predicate = strip`
      export function is${name}(value: number): value is ${name} {
        return value >= ${offset} && value <= ${max};
      }
    `;
  } else {
    predicate = strip`
      export function is${name}(value: number): value is ${name} {
        return value >= ${offset};
      }
    `;
  }

  return { enumString, predicate };
}

export function strip(strings: TemplateStringsArray, ...args: unknown[]) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    let string = strings[i];
    let dynamic = args[i] !== undefined ? String(args[i]) : '';

    out += `${string}${dynamic}`;
  }

  /* eslint-disable-next-line regexp/no-super-linear-backtracking,
     @typescript-eslint/no-non-null-assertion -- @fixme */
  out = /^\s*?\n?([\s\S]*?)\s*$/u.exec(out)![1] as string;

  let min = Number.MAX_SAFE_INTEGER;

  for (let line of out.split('\n')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
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
