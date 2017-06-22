import { VersionedPathReference } from "@glimmer/reference";
import { Opaque, SymbolTable, Specifier, Resolver } from "@glimmer/interfaces";

export type ConstantReference =  number;
export type ConstantString = number;
export type ConstantExpression = number;
export type ConstantSlice = number;
export type ConstantBlock = number;
export type ConstantSymbolTable = number;
export type ConstantFunction = number;
export type ConstantArray = number;
export type ConstantOther = number;

const UNRESOLVED = {};

export class Constants {
  constructor(private resolver: Resolver) {}

  // `0` means NULL

  private references: VersionedPathReference<Opaque>[] = [];
  private strings: string[] = [];
  private expressions: Opaque[] = [];
  private arrays: number[][] = [];
  private tables: SymbolTable[] = [];
  private functions: Function[] = [];
  private specifiers: Specifier[] = [];
  private resolved: Opaque[] = [];

  getReference<T extends Opaque>(value: ConstantReference): VersionedPathReference<T> {
    return this.references[value - 1] as VersionedPathReference<T>;
  }

  reference(value: VersionedPathReference<Opaque>): ConstantReference {
    let index = this.references.length;
    this.references.push(value);
    return index + 1;
  }

  getString(value: ConstantString): string {
    return this.strings[value - 1];
  }

  string(value: string): ConstantString {
    let index = this.strings.length;
    this.strings.push(value);
    return index + 1;
  }

  getExpression<T>(value: ConstantExpression): T {
    return this.expressions[value - 1] as T;
  }

  getArray(value: ConstantArray): number[] {
    return this.arrays[value - 1];
  }

  getNames(value: ConstantArray): string[] {
    let _names: string[] = [];
    let names = this.getArray(value);

    for (let i = 0; i < names.length; i++) {
      let n = names[i];
      _names[i] = this.getString(n);
    }

    return _names;
  }

  array(values: number[]): ConstantArray {
    let index = this.arrays.length;
    this.arrays.push(values);
    return index + 1;
  }

  getFunction<T extends Function>(value: ConstantFunction): T {
    return this.functions[value - 1] as T;
  }

  function(f: Function): ConstantFunction {
    let index = this.functions.length;
    this.functions.push(f);
    return index + 1;
  }

  getSymbolTable<T extends SymbolTable>(value: ConstantSymbolTable): T {
    return this.tables[value - 1] as T;
  }

  table(t: SymbolTable): ConstantSymbolTable {
    let index = this.tables.length;
    this.tables.push(t);
    return index + 1;
  }

  resolveSpecifier<T>(s: number): T {
    let resolved = this.resolved[s];

    if (resolved === UNRESOLVED) {
      let specifier = this.specifiers[s];
      resolved = this.resolved[s] = this.resolver.resolve(specifier);
    }

    return resolved as T;
  }

  specifier(specifier: Specifier): number {
    let index = this.specifiers.length;
    this.specifiers.push(specifier);
    this.resolved.push(UNRESOLVED);
    return index + 1;
  }
}

export class LazyConstants extends Constants {
  private others: Opaque[] = [];

  getOther<T>(value: ConstantOther): T {
    return this.others[value - 1] as T;
  }

  other(other: Opaque): ConstantOther {
    let index = this.others.length;
    this.others.push(other);
    return index + 1;
  }
}
