declare const Mod: (imports: any) => {
  stack_new(): number;
  stack_free(stack: number): void;
  stack_copy(stack: number, from: number, to: number): number;
  stack_write_raw(stack: number, at: number, val: number): void;
  stack_write(stack: number, at: number, val: number): void;
  stack_read_raw(stack: number, at: number): number;
  stack_read(stack: number, at: number): number;
  stack_reset(stack: number): void;
};
export default Mod;
