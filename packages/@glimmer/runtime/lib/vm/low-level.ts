import { Heap, Opcode, Externs } from "@glimmer/program";
import { Option, Opaque } from "@glimmer/interfaces";
import EvaluationStack from './stack';
import VM from './append';
import { wasm, WasmLowLevelVM } from '@glimmer/low-level';
import { DEVMODE } from "@glimmer/local-debug-flags";
import { APPEND_OPCODES } from '../opcodes';

export interface Program {
  opcode(offset: number): Opcode;
}

export default class LowLevelVM {
  private wasmVM: WasmLowLevelVM; // TODO: need to free this somewhere
  public stack: EvaluationStack;

  constructor(
    public heap: Heap,
    public program: Program,
    public externs: Externs,
  ) {
    // note that this 0 here indicate the heap, but it's passed elsewhere for
    // now so it's just a dummy values
    this.wasmVM = wasm.exports.LowLevelVM.new(heap, APPEND_OPCODES, externs, DEVMODE);

    // TODO: this is more sketchy memory management! We own `this.wasmVM` yet
    // we're giving it off to the evaluation stack as well. That's mostly to
    // just get things working for now, but we probably don't want to do
    // that in the future and either use things like `Rc` in Rust or some
    // other slightly more principled memory management scheme.
    this.stack = new EvaluationStack(this.wasmVM);
  }

  get currentOpSize(): number {
    return this.wasmVM.current_op_size();
  }

  get pc(): number {
    return this.wasmVM.pc();
  }

  set pc(pc: number) {
    this.wasmVM.set_pc(pc);
  }

  get ra(): number {
    return this.wasmVM.ra();
  }

  set ra(ra: number) {
    this.wasmVM.set_ra(ra);
  }

  // Start a new frame and save $ra and $fp on the stack
  pushFrame() {
    this.wasmVM.push_frame();
  }

  // Restore $ra, $sp and $fp
  popFrame() {
    this.wasmVM.pop_frame();
  }

  // Jump to an address in `program`
  goto(offset: number) {
    this.wasmVM.goto(offset);
  }

  // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
  call(handle: number) {
    this.wasmVM.call(handle);
  }

  // Put a specific `program` address in $ra
  returnTo(offset: number) {
    this.wasmVM.return_to(offset);
  }

  // Return to the `program` address stored in $ra
  return() {
    this.wasmVM.return_();
  }

  nextStatement(): Option<Opcode> {
    const next = this.wasmVM.next_statement();
    if (next === -1)
      return null;
    let opcode = new Opcode(this.heap);
    opcode.offset = next;
    return opcode;
  }

  evaluateOuter(opcode: Opcode, vm: VM<Opaque>) {
    this.wasmVM.evaluate_outer(opcode.offset, vm);
  }

  dropWasm() {
    this.wasmVM.free();
  }
}
