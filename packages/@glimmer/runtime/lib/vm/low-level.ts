import { Heap, Opcode } from "@glimmer/program";
import { Option, Opaque } from "@glimmer/interfaces";
import EvaluationStack from './stack';
import VM from './append';
import { wasm } from '@glimmer/low-level';
import { DEVMODE } from "@glimmer/local-debug-flags";

export interface Program {
  opcode(offset: number): Opcode;
}

export interface Externs {
  debugBefore(opcode: Opcode): Opaque;
  debugAfter(opcode: Opcode, state: Opaque): void;
}

export default class LowLevelVM {
  private wasmVM: number; // TODO: need to free this somewhere
  public stack: EvaluationStack;

  constructor(
    public heap: Heap,
    public program: Program,
    public externs: Externs,
  ) {
    // note that this 0 here indicate the heap, but it's passed elsewhere for
    // now so it's just a dummy values
    this.wasmVM = wasm.low_level_vm_new(0, DEVMODE ? 1 : 0);

    // TODO: this is more sketchy memory management! We own `this.wasmVM` yet
    // we're giving it off to the evaluation stack as well. That's mostly to
    // just get things working for now, but we probably don't want to do
    // that in the future and either use things like `Rc` in Rust or some
    // other slightly more principled memory management scheme.
    this.stack = new EvaluationStack(this.wasmVM);
  }

  get currentOpSize(): number {
    return wasm.low_level_vm_current_op_size(this.wasmVM);
  }

  get pc(): number {
    return wasm.low_level_vm_pc(this.wasmVM);
  }

  set pc(pc: number) {
    wasm.low_level_vm_set_pc(this.wasmVM, pc);
  }

  get ra(): number {
    return wasm.low_level_vm_ra(this.wasmVM);
  }

  set ra(ra: number) {
    wasm.low_level_vm_set_ra(this.wasmVM, ra);
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    wasm.low_level_vm_push_frame(this.wasmVM);
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    wasm.low_level_vm_pop_frame(this.wasmVM);
  }

  // Jump to an address in `program`
  goto(offset: number) {
    wasm.low_level_vm_goto(this.wasmVM, offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    wasm.low_level_vm_call(this.wasmVM, handle);
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    wasm.low_level_vm_return_to(this.wasmVM, offset);
  }

  // Return to the `program` address stored in $ra
  return() {
    wasm.low_level_vm_return(this.wasmVM);
  }

  nextStatement(): Option<Opcode> {
    return wasm.low_level_vm_next_statement(this.wasmVM, this.heap);
  }

  evaluateOuter(opcode: Opcode, vm: VM<Opaque>) {
    wasm.low_level_vm_evaluate(this.wasmVM, vm, this.externs, this.heap, opcode);
  }

  dropWasm() {
    const wasmVM = this.wasmVM;
    this.wasmVM = 0;
    this.stack.dropWasm();
    wasm.low_level_vm_free(wasmVM);
  }
}
