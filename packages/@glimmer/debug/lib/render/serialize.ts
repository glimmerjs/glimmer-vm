import type { BlockMetadata, DebugVmSnapshot } from '@glimmer/interfaces';
import { exhausted } from '@glimmer/util';

import type { DisassembledOperand, RegisterName, SomeDisassembledOperand } from '../debug';
import type {IntoFragment} from './presets';

import { stackValue } from './combinators';
import { as,frag  } from './presets';

export class SerializeBlockContext {
  readonly #block: Pick<BlockMetadata, 'debugSymbols'> | null;

  constructor(block: Pick<BlockMetadata, 'debugSymbols'> | null) {
    this.#block = block;
  }

  serialize(param: SomeDisassembledOperand): IntoFragment {
    switch (param.type) {
      case 'number':
      case 'boolean':
      case 'string':
      case 'primitive':
        return this.#stringify(param.value, 'stringify');
      case 'array':
        return param.value?.map((value) => this.#stringify(value, 'unknown')) ?? null;
      case 'dynamic':
      case 'constant':
        return stackValue(param.value);
      case 'register':
        return this.#stringify(param.value, 'register');
      case 'instruction':
        return this.#stringify(param.value, 'pc');
      case 'variable': {
        const value = param.value;
        if (value === 0) {
          return frag`{${as.kw('this')}}`;
        } else if (this.#block?.debugSymbols && this.#block.debugSymbols.length >= value) {
          // @fixme something is wrong here -- remove the `&&` to get test failures
          return frag`${as.varReference(
            this.#block.debugSymbols[value - 1]!
          )}${frag`:${value}`.subtle()}`;
        } else {
          return frag`{${as.register('$fp')}+${value}}`;
        }
      }

      case 'error:opcode':
        return `{raw:${param.value}}`;
      case 'error:operand':
        return `{err:${param.options.label.name}=${param.value}}`;
      case 'enum<curry>':
        return `<curry:${param.value}>`;

      default:
        exhausted(param);
    }
  }

  #stringify(value: number, type: 'constant'): string;
  #stringify(value: RegisterName, type: 'register'): string;
  #stringify(value: number, type: 'variable' | 'pc'): string;
  #stringify(value: DisassembledOperand['value'], type: 'stringify' | 'unknown'): string;
  #stringify(
    value: unknown,
    type: 'stringify' | 'constant' | 'register' | 'variable' | 'pc' | 'unknown'
  ) {
    switch (type) {
      case 'stringify':
        return JSON.stringify(value);
      case 'constant':
        return `${this.#stringify(value, 'unknown')}`;
      case 'register':
        return value;
      case 'variable': {
        if (value === 0) {
          return `{this}`;
        } else if (
          this.#block?.debugSymbols &&
          this.#block.debugSymbols.length >= (value as number)
        ) {
          return `{${this.#block.debugSymbols[(value as number) - 1]}:${value}}`;
        } else {
          return `{$fp+${value}}`;
        }
      }
      case 'pc':
        return `@${value}`;
      case 'unknown': {
        switch (typeof value) {
          case 'function':
            return '<function>';
          case 'number':
          case 'string':
          case 'bigint':
          case 'boolean':
            return JSON.stringify(value);
          case 'symbol':
            return `${String(value)}`;
          case 'undefined':
            return 'undefined';
          case 'object': {
            if (value === null) return 'null';
            if (Array.isArray(value)) return `<array[${value.length}]>`;

            let name = value.constructor.name;

            switch (name) {
              case 'Error':
              case 'RangeError':
              case 'ReferenceError':
              case 'SyntaxError':
              case 'TypeError':
              case 'WeakMap':
              case 'WeakSet':
                return `<${name}>`;
              case 'Object':
                return `<${name}>`;
            }

            if (value instanceof Map) {
              return `<Map[${value.size}]>`;
            } else if (value instanceof Set) {
              return `<Set[${value.size}]>`;
            } else {
              return `<${name}>`;
            }
          }
        }
      }
    }
  }
}

export type SerializableDebug = {
  [P in keyof DebugVmSnapshot as SerializableKey<DebugVmSnapshot, P>]: DebugVmSnapshot[P];
};

export type SerializableKey<O, P extends keyof O> = {
  [K in P]: O[P] extends IntoFragment ? K : never;
}[P];
