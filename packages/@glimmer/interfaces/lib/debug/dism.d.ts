export type AnyOperand = [type: string, value: never, options?: object];
export type OperandTypeOf<O extends AnyOperand> = O[0];
export type OperandValueOf<O extends AnyOperand> = O[1];
export type OperandOptionsOf<O extends AnyOperand> = O extends [
  type: string,
  value: never,
  options: infer Options,
]
  ? Options
  : void;
export type OperandOptionsA<O extends AnyOperand> = O extends [
  type: string,
  value: never,
  options: infer Options,
]
  ? Options
  : {};

type ExtractA<O> = O extends { a: infer A } ? A : never;
type ExpandUnion<U> = U extends infer O ? ExtractA<{ a: O }> : never;

export type NullableOperand<O extends AnyOperand> =
  | [OperandTypeOf<O>, OperandValueOf<O>, Expand<OperandOptionsA<O> & { nullable?: false }>]
  | [
      OperandTypeOf<O>,
      Nullable<OperandValueOf<O>>,
      Expand<OperandOptionsA<O> & { nullable: true }>,
    ];

export type NullableName<T extends string> = T extends `${infer N}?` ? N : never;

export type WithOptions<O extends AnyOperand, Options> = ExpandUnion<
  [OperandTypeOf<O>, OperandValueOf<O>, Expand<OperandOptionsA<O> & Options>]
>;

// expands object types one level deep
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type DefineOperand<T extends string, V, Options = undefined> = undefined extends Options
  ? readonly [type: T, value: V]
  : readonly [type: T, value: V, options: Options];

type DefineNullableOperand<T extends string, V, Options = undefined> = Options extends undefined
  ?
      | readonly [type: T, value: V]
      | readonly [type: T, value: Nullable<V>, options: { nullable: true }]
      | readonly [type: T, value: V, options: { nullable?: false }]
  :
      | readonly [type: T, value: Nullable<V>, options: Expand<Options & { nullable: true }>]
      | readonly [type: T, value: V, options: Expand<Options & { nullable?: false }>]
      | readonly [type: T, value: V, options: Options];

/**
 * A dynamic operand has a value that can't be easily represented as an embedded string.
 */
export type RawDynamicDisassembledOperand =
  | DefineOperand<'dynamic', unknown>
  | DefineOperand<'constant', number>
  | DefineNullableOperand<'array', unknown[]>
  | DefineOperand<'variable', number, { name?: string | null }>;

export type RawStaticDisassembledOperand =
  | DefineOperand<'error:operand', number, { label: NormalizedOperand }>
  | DefineOperand<'error:opcode', number, { kind: number }>
  | DefineOperand<'number', number>
  | DefineOperand<'boolean', boolean>
  | DefineOperand<'primitive', Primitive>
  | DefineOperand<'register', RegisterName>
  | DefineOperand<'instruction', number>
  | DefineOperand<'enum<curry>', 'component' | 'helper' | 'modifier'>
  | DefineOperand<'array', number[], { kind: typeof Number }>
  | DefineNullableOperand<'array', string[], { kind: typeof String }>
  /**
   * A variable is a numeric offset into the stack (relative to the $fp register).
   */
  | DefineNullableOperand<'string', string>;

export type RawDisassembledOperand = RawStaticDisassembledOperand | RawDynamicDisassembledOperand;

type ObjectForRaw<R> = R extends RawDisassembledOperand
  ? R[2] extends undefined
    ? {
        type: R[0];
        value: R[1];
        options?: R[2];
      }
    : {
        type: R[0];
        value: R[1];
        options: R[2];
      }
  : never;

export type StaticDisassembledOperand = ObjectForRaw<RawStaticDisassembledOperand> & {
  isDynamic: false;
};
export type DynamicDisassembledOperand = ObjectForRaw<RawDynamicDisassembledOperand> & {
  isDynamic: true;
};

export type SomeDisassembledOperand = StaticDisassembledOperand | DynamicDisassembledOperand;

export interface DebugOp {
  name: string;
  params: Dict<SomeDisassembledOperand>;
  meta: BlockMetadata | null;
}

export type OpSnapshot = Pick<RuntimeOp, 'offset' | 'size' | 'type' | 'op1' | 'op2' | 'op3'>;

export interface DisassembledOperand<R extends RawDisassembledOperand = RawDisassembledOperand> {
  readonly type: R[0];
  readonly value: R[1];
  readonly options: R[2];
}

export interface VmSnapshot {
  diff(other: VmSnapshot): VmDiff;
}
