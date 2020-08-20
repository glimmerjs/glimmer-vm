import { ProgramSymbolTable } from '../shared/symbol-table';
import { Block, ComponentBlock, NamedBlock } from './blocks';
import * as out from './out';

export interface Check<T extends In, In = out.StackValue> {
  name: string;
  match(value: In): value is T;
}

export const PRESENT: Check<NonNullable<unknown>, unknown> = {
  name: 'present',
  match(value: unknown): value is NonNullable<unknown> {
    return value !== null && value !== undefined;
  },
};

export const ABSENT: Check<null | undefined, unknown> = {
  name: 'absent',
  match(value: unknown): value is null | undefined {
    return value === null || value === undefined;
  },
};

export function AND<T extends In, U extends In, In>(
  left: Check<T, In>,
  right: Check<U, In>
): Check<T & U, In> {
  return {
    name: `${left.name} & ${right.name}`,
    match(value: In): value is T & U {
      return left.match(value) && right.match(value);
    },
  };
}

export function present<T extends In, In>(check: Check<T, In>): Check<NonNullable<T>, In> {
  return AND(PRESENT, check) as Check<NonNullable<T>, In>;
}

export const ANY: Check<out.StackValue> = {
  name: 'any',
  match(_value: out.StackValue): _value is out.StackValue {
    return true;
  },
};

export const MAYBE_EXPR: Check<out.Expr | out.Missing, out.StackValue> = {
  name: 'Expr?',
  match(value: out.StackValue): value is out.Expr | out.Missing {
    switch (value.name) {
      case 'Missing':
      case 'Undefined':
      case 'Value':
      case 'GetSymbol':
      case 'GetContextualFree':
      case 'GetFree':
      case 'GetPath':
      case 'Concat':
      case 'Call':
      case 'HasBlock':
      case 'HasBlockParams':
        return true;
      default:
        return false;
    }
  },
};

export const EXPR: Check<out.Expr> = {
  name: 'Expr',
  match(value: out.StackValue): value is out.Expr {
    switch (value.name) {
      case 'Undefined':
      case 'Value':
      case 'GetSymbol':
      case 'GetContextualFree':
      case 'GetFree':
      case 'GetPath':
      case 'Concat':
      case 'Call':
      case 'HasBlock':
      case 'HasBlockParams':
        return true;
      default:
        return false;
    }
  },
};

export const PARAMS: Check<out.AnyParams> = {
  name: 'Params',
  match(value: out.StackValue): value is out.AnyParams {
    return value.name === 'Params' || value.name === 'EmptyParams';
  },
};

export const CONCAT_PARAMS: Check<out.Params> = {
  name: 'ConcatParams',
  match(value: out.StackValue): value is out.Params {
    return value.name === 'Params';
  },
};

export const HASH: Check<out.AnyHash> = {
  name: 'Hash',
  match(value: out.StackValue): value is out.AnyHash {
    return value.name === 'Hash' || value.name === 'EmptyHash';
  },
};

export const HASH_PAIR: Check<out.HashPair> = {
  name: 'HashPair',
  match(value: out.StackValue): value is out.HashPair {
    return value.name === 'HashPair';
  },
};

export const GET: Check<out.GetVar> = {
  name: 'GetVar',
  match(value: out.StackValue): value is out.GetVar {
    return (
      value.name === 'GetSymbol' || value.name === 'GetFree' || value.name === 'GetContextualFree'
    );
  },
};

export const STRING: Check<out.SourceSlice> = {
  name: 'SourceSlice',
  match(value: out.StackValue): value is out.SourceSlice {
    return value.name === 'SourceSlice';
  },
};

export const PROGRAM_SYMBOL_TABLE: Check<ProgramSymbolTable, unknown> = {
  name: 'ProgramSymbolTable',
  match(value: unknown): value is ProgramSymbolTable {
    if (typeof value !== 'object' || value === null) {
      return false;
    } else {
      return value instanceof ProgramSymbolTable;
    }
  },
};

export const MAYBE_NAMED_BLOCK: Check<NamedBlock | undefined, Block | undefined> = {
  name: 'NamedBlock?',
  match(value: Block | undefined): value is NamedBlock | undefined {
    return value === undefined || value instanceof NamedBlock;
  },
};

export const NAMED_BLOCK: Check<NamedBlock, NamedBlock | undefined> = {
  name: 'NamedBlock',
  match(value: Block | undefined): value is NamedBlock {
    return value !== undefined && value instanceof NamedBlock;
  },
};

export const COMPONENT_BLOCK: Check<ComponentBlock, Block | undefined> = {
  name: 'ComponentBlock',
  match(value: Block | undefined): value is ComponentBlock {
    return value !== undefined && value instanceof ComponentBlock;
  },
};

export function check<T extends In, In>(value: In, checker: Check<T, In>): T {
  if (checker.match(value)) {
    return value;
  } else {
    throw new Error(`ASSERT: value wasn't a ${checker.name}`);
  }
}
