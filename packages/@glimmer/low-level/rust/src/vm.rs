use std::cell::Cell;

use wasm_bindgen::prelude::*;

// TODO: don't use this private internal, this should be vendored here or
//       officially exposed upstream in `wasm_bindgen`.
use wasm_bindgen::__rt::WasmRefCell as RefCell;

use ffi;
use opcode::{Opcode, Op};
use stack;

pub struct Stack {
    fp: i32,
    sp: i32,
    inner: stack::Stack,
}

impl Stack {
    pub fn new(fp: i32, sp: i32, stack: stack::Stack) -> Stack {
        Stack {
            fp,
            sp,
            inner: stack,
        }
    }

    pub fn fp(&self) -> i32 {
        self.fp
    }

    pub fn set_fp(&mut self, fp: i32) {
        self.fp = fp;
    }

    pub fn sp(&self) -> i32 {
        self.sp
    }

    pub fn set_sp(&mut self, sp: i32) {
        self.sp = sp;
    }

    pub fn push_smi(&mut self, val: i32) {
        self.sp += 1;
        self.inner.write(to_u32(self.sp), val)
    }

    pub fn pop_smi(&mut self) -> i32 {
        let ret = self.inner.read(to_u32(self.sp));
        self.sp -= 1;
        debug_assert!(ret.is_some()); // this should be an in-bounds read
        ret.unwrap_or(0)
    }

    pub fn get_smi(&mut self, offset: u32) -> i32 {
        let ret = self.inner.read(to_u32(self.fp) + offset);
        debug_assert!(ret.is_some()); // this should be an in-bounds read
        ret.unwrap_or(0)
    }

    pub fn as_inner_usize(&self) -> usize {
        self.inner.as_usize()
    }
}

pub struct Heap {
    handle: JsObject,
}

impl Heap {
    pub fn new(handle: JsObject) -> Heap {
        Heap { handle }
    }

    pub fn get_addr(&self, at: u32) -> i32 {
        ffi::low_level_vm_heap_get_addr(&self.handle, at)
    }

    pub fn get_by_addr(&self, at: u32) -> u32 {
        ffi::low_level_vm_heap_get_by_addr(&self.handle, at)
    }
}

wasm_bindgen! {
    pub struct LowLevelVM {
        // Right now these are encoded as `i32` because the "exit" address is
        // encoded as -1, but these may wish to change in the future to a `u32`
        // representation.
        pc: Cell<i32>,
        ra: Cell<i32>,
        current_op_size: Cell<i32>,
        stack: RefCell<Stack>,
        heap: Heap,
        devmode: bool,
        syscalls: JsObject,
        externs: JsObject,
    }

    impl LowLevelVM {
        pub fn new(heap: JsObject,
                   syscalls: JsObject,
                   externs: JsObject,
                   devmode: bool) -> LowLevelVM {
            let stack = stack::Stack::new();
            let stack = Stack::new(0, -1, stack);
            let heap = Heap::new(heap);
            LowLevelVM {
                pc: Cell::new(-1),
                ra: Cell::new(-1),
                current_op_size: Cell::new(0),
                stack: RefCell::new(stack),
                heap,
                devmode,
                syscalls,
                externs,
            }
        }

        pub fn current_op_size(&self) -> u32 {
            to_u32(self.current_op_size.get())
        }

        pub fn ra(&self) -> i32 {
            self.ra.get()
        }

        pub fn set_ra(&self, ra: i32) {
            self.ra.set(ra);
        }

        pub fn pc(&self) -> i32 {
            self.pc.get()
        }

        pub fn set_pc(&self, pc: i32) {
            self.pc.set(pc);
        }

        pub fn fp(&self) -> i32 {
            self.stack.borrow().fp()
        }

        pub fn set_fp(&self, fp: i32) {
            self.stack.borrow_mut().set_fp(fp);
        }

        pub fn sp(&self) -> i32 {
            self.stack.borrow().sp()
        }

        pub fn set_sp(&self, sp: i32) {
            self.stack.borrow_mut().set_sp(sp);
        }

        // Start a new frame and save $ra and $fp on the stack
        pub fn push_frame(&self) {
            let mut stack = self.stack.borrow_mut();
            stack.push_smi(self.ra.get());
            let fp = stack.fp();
            stack.push_smi(fp);
            let sp = stack.sp();
            stack.set_fp(sp - 1);
        }

        // Restore $ra, $sp and $fp
        fn pop_frame(&self) {
            let mut stack = self.stack.borrow_mut();
            let fp = stack.fp();
            stack.set_sp(fp - 1);
            self.ra.set(stack.get_smi(0));
            let fp = stack.get_smi(1);
            stack.set_fp(fp);
        }

        // Jump to an address in the program
        pub fn goto(&self, offset: i32) {
            self.pc.set(self.pc.get() + offset - self.current_op_size.get());
        }

        // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
        pub fn call(&self, handle: u32) {
            self.ra.set(self.pc.get());
            self.pc.set(self.heap.get_addr(handle));
        }

        // Put a specific `program` address in $ra
        fn return_to(&self, offset: i32) {
            self.ra.set(self.pc.get() + offset - self.current_op_size.get());
        }

        // Return to the `program` address stored in $ra
        fn return_(&self) {
            self.pc.set(self.ra.get());
        }

        pub fn evaluate_all(&self, vm: &JsObject) {
            while self.evaluate_one(vm) {
                // ...
            }
        }

        pub fn evaluate_one(&self, vm: &JsObject) -> bool {
            match self.next_statement() {
                Some(opcode) => { self.evaluate_outer(opcode, vm); true }
                None => false,
            }
        }

        fn next_statement(&self) -> Option<Opcode> {
            if self.pc.get() == -1 {
                return None
            }

            // We have to save off the current operations size so that
            // when we do a jump we can calculate the correct offset
            // to where we are going. We can't simply ask for the size
            // in a jump because we have have already incremented the
            // program counter to the next instruction prior to executing.
            let opcode = Opcode::new(to_u32(self.pc.get()));
            self.current_op_size.set(to_i32(opcode.size(&self.heap)));
            self.pc.set(self.pc.get() + self.current_op_size.get());
            Some(opcode)
        }

        fn evaluate_outer(&self, opcode: Opcode, vm: &JsObject) {
            let state = if self.devmode {
                Some(ffi::low_level_vm_debug_before(&self.externs,
                                                    opcode.offset()))
            } else {
                None
            };

            self.evaluate_inner(opcode, vm);

            if let Some(state) = state {
                ffi::low_level_vm_debug_after(&self.externs,
                                              state,
                                              opcode.offset());
            }
        }

        fn evaluate_inner(&self, opcode: Opcode, vm: &JsObject) {
            if opcode.is_machine(&self.heap) {
                self.evaluate_machine(opcode)
            } else {
                self.evaluate_syscall(opcode, vm)
            }
        }

        fn evaluate_machine(&self, opcode: Opcode) {
            debug_assert!(opcode.is_machine(&self.heap));
            match opcode.op(&self.heap) {
                Op::PushFrame => self.push_frame(),
                Op::PopFrame => self.pop_frame(),
                Op::InvokeStatic => {
                    let op1 = opcode.op1(&self.heap);
                    self.call(op1)
                }
                Op::InvokeVirtual => {
                    let addr = self.stack.borrow_mut().pop_smi();
                    self.call(to_u32(addr))
                }
                Op::Jump => {
                    let op1 = to_i32(opcode.op1(&self.heap));
                    self.goto(op1)
                }
                Op::Return => self.return_(),
                Op::ReturnTo => {
                    let op1 = to_i32(opcode.op1(&self.heap));
                    self.return_to(op1)
                }
                op => {
                    debug_assert!(!opcode.is_machine(&self.heap),
                                  "bad opcode {:?}", op);
                }
            }
        }

        fn evaluate_syscall(&self, opcode: Opcode, vm: &JsObject) {
            ffi::low_level_vm_evaluate_syscall(&self.syscalls,
                                               vm,
                                               opcode.offset())
        }

        pub fn stack_copy(&self, from: u32, to: u32) -> bool {
            self.stack.borrow_mut().inner.copy(from, to).is_ok()
        }

        pub fn stack_write_raw(&self, at: u32, val: u32) {
            self.stack.borrow_mut().inner.write_raw(at, val);
        }

        pub fn stack_write(&self, at: u32, val: i32) {
            self.stack.borrow_mut().inner.write(at, val);
        }

        pub fn stack_read_raw(&self, at: u32) -> u32 {
            self.stack.borrow().inner.read_raw(at).unwrap_or(0)
        }

        pub fn stack_read(&self, at: u32) -> i32 {
            self.stack.borrow().inner.read(at).unwrap_or(0)
        }

        pub fn stack_reset(&self) {
            self.stack.borrow_mut().inner.reset();
        }
    }
}

impl LowLevelVM {
    pub fn stack_inner_usize(&self) -> usize {
        self.stack.borrow().as_inner_usize()
    }
}

fn to_i32(a: u32) -> i32 {
    debug_assert!(a < (i32::max_value() as u32));
    a as i32
}

fn to_u32(a: i32) -> u32 {
    debug_assert!(a >= 0);
    a as u32
}
