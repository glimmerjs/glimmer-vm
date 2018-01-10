use wasm_bindgen::prelude::*;

use ffi;
use gbox::GBox;
use my_ref_cell::MyRefCell;
use opcode::{Opcode, Op};
use stack::Stack;
use track::Tracked;
use {to_u32, to_i32};

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

pub struct VM {
    stack: Stack,
    heap: Heap,

    // Right now these are encoded as `i32` because the "exit" address is
    // encoded as -1, but these may wish to change in the future to a `u32`
    // representation.
    pc: i32,
    ra: i32,
    current_op_size: i32,

    boxed_registers: [GBox; 5],

    _tracked: Tracked,
}

// these should all stay in sync with `registers.ts`
pub const PC: usize = 0;
pub const RA: usize = 1;
pub const FP: usize = 2;
pub const SP: usize = 3;
pub const S0: usize = 4;
pub const S1: usize = 5;
pub const T0: usize = 6;
pub const T1: usize = 7;
pub const V0: usize = 8;

impl VM {
    fn new(heap: JsObject) -> VM {
        let stack = Stack::new(0, -1);
        let heap = Heap::new(heap);
        VM {
            pc: -1,
            ra: -1,
            current_op_size: 0,
            stack: stack,
            heap,
            boxed_registers: [GBox::null(); 5],
            _tracked: Tracked::new(),
        }
    }

    fn register(&self, i: usize) -> GBox {
        match i {
            PC => GBox::i32(self.pc),
            RA => GBox::i32(self.ra),
            FP => GBox::i32(self.stack.fp()),
            SP => GBox::i32(self.stack.sp()),
            _ => {
                let reg = self.boxed_registers.get(i - S0);
                debug_assert!(reg.is_some());
                reg.cloned().unwrap_or(GBox::null())
            }
        }
    }

    fn set_register(&mut self, i: usize, val: GBox) {
        match i {
            PC => self.pc = val.unwrap_i32(),
            RA => self.ra = val.unwrap_i32(),
            FP => self.stack.set_fp(val.unwrap_i32()),
            SP => self.stack.set_sp(val.unwrap_i32()),
            _ => {
                match self.boxed_registers.get_mut(i - S0) {
                    Some(slot) => *slot = val,
                    None => panic!("invalid register index: {}", i),
                }
            }
        }
    }

    // Start a new frame and save $ra and $fp on the stack
    fn push_frame(&mut self) {
        self.stack.push_smi(self.ra);
        let fp = self.stack.fp();
        self.stack.push_smi(fp);
        let sp = self.stack.sp();
        self.stack.set_fp(sp - 1);
    }

    // Restore $ra, $sp and $fp
    fn pop_frame(&mut self) {
        let fp = self.stack.fp();
        self.stack.set_sp(fp - 1);
        self.ra = self.stack.get_smi(0);
        let fp = self.stack.get_smi(1);
        self.stack.set_fp(fp);
    }

    // Jump to an address in the program
    fn goto(&mut self, offset: i32) {
        self.pc = self.pc + offset - self.current_op_size;
    }

    // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
    fn call(&mut self, handle: u32) {
        self.ra = self.pc;
        self.pc = self.heap.get_addr(handle);
    }

    // Put a specific `program` address in $ra
    fn return_to(&mut self, offset: i32) {
        self.ra = self.pc + offset - self.current_op_size;
    }

    // Return to the `program` address stored in $ra
    fn return_(&mut self) {
        self.pc = self.ra;
    }

    fn next_statement(&mut self) -> Option<Opcode> {
        if self.pc == -1 {
            return None
        }

        // We have to save off the current operations size so that
        // when we do a jump we can calculate the correct offset
        // to where we are going. We can't simply ask for the size
        // in a jump because we have have already incremented the
        // program counter to the next instruction prior to executing.
        let opcode = Opcode::new(to_u32(self.pc));
        self.current_op_size = to_i32(opcode.size(&self.heap));
        self.pc = self.pc + self.current_op_size;
        Some(opcode)
    }

    fn evaluate_machine(&mut self, opcode: Opcode) {
        debug_assert!(opcode.is_machine(&self.heap));
        match opcode.op(&self.heap) {
            Op::PushFrame => self.push_frame(),
            Op::PopFrame => self.pop_frame(),
            Op::InvokeStatic => {
                let op1 = opcode.op1(&self.heap);
                self.call(op1)
            }
            Op::InvokeVirtual => {
                let addr = self.stack.pop_smi();
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

    fn evaluate_syscall_in_rust(&mut self, opcode: Opcode, _vm: &JsObject) -> bool {
        match opcode.op(&self.heap) {
            Op::Pop => {
                let count = opcode.op1(&self.heap);
                self.stack.pop(to_i32(count));
            }
            _ => return false
        }

        true
    }
}

wasm_bindgen! {
    pub struct LowLevelVM {
        inner: MyRefCell<VM>,
        devmode: bool,
        syscalls: JsObject,
        externs: JsObject,
    }

    impl LowLevelVM {
        pub fn new(heap: JsObject,
                   syscalls: JsObject,
                   externs: JsObject,
                   devmode: bool) -> LowLevelVM {
            LowLevelVM {
                inner: MyRefCell::new(VM::new(heap)),
                devmode,
                syscalls,
                externs,
            }
        }

        pub fn current_op_size(&self) -> u32 {
            to_u32(self.inner.borrow().current_op_size)
        }

        pub fn ra(&self) -> i32 {
            self.inner.borrow().ra
        }

        pub fn set_ra(&self, ra: i32) {
            self.inner.borrow_mut().ra = ra;
        }

        pub fn pc(&self) -> i32 {
            self.inner.borrow().pc
        }

        pub fn set_pc(&self, pc: i32) {
            self.inner.borrow_mut().pc = pc;
        }

        pub fn fp(&self) -> i32 {
            self.inner.borrow().stack.fp()
        }

        pub fn set_fp(&self, fp: i32) {
            self.inner.borrow_mut().stack.set_fp(fp)
        }

        pub fn sp(&self) -> i32 {
            self.inner.borrow().stack.sp()
        }

        pub fn set_sp(&self, sp: i32) {
            self.inner.borrow_mut().stack.set_sp(sp)
        }

        pub fn register(&self, i: usize) -> u32 {
            self.inner.borrow().register(i).bits()
        }

        pub fn set_register(&self, i: usize, val: u32) {
            self.inner.borrow_mut().set_register(i, GBox::from_bits(val));
        }

        pub fn push_frame(&self) {
            self.inner.borrow_mut().push_frame()
        }

        pub fn goto(&self, offset: i32) {
            self.inner.borrow_mut().goto(offset)
        }

        pub fn call(&self, handle: u32) {
            self.inner.borrow_mut().call(handle)
        }

        pub fn evaluate_all(&self, vm: &JsObject) {
            while self.evaluate_one(vm) {
                // ...
            }
        }

        pub fn evaluate_one(&self, vm: &JsObject) -> bool {
            let opcode = match self.inner.borrow_mut().next_statement() {
                Some(opcode) => opcode,
                None => return false,
            };

            let state = if self.devmode {
                Some(ffi::low_level_vm_debug_before(&self.externs,
                                                    opcode.offset()))
            } else {
                None
            };

            {
                let mut inner = self.inner.borrow_mut();
                if opcode.is_machine(&inner.heap) {
                    inner.evaluate_machine(opcode)
                } else if !inner.evaluate_syscall_in_rust(opcode, vm) {
                    drop(inner);
                    ffi::low_level_vm_evaluate_syscall(&self.syscalls,
                                                       vm,
                                                       opcode.offset())
                }
            }

            if let Some(state) = state {
                ffi::low_level_vm_debug_after(&self.externs,
                                              state,
                                              opcode.offset());
            }
            return true
        }

        pub fn stack_copy(&self, from: u32, to: u32) -> bool {
            self.inner.borrow_mut().stack.copy(from, to).is_ok()
        }

        pub fn stack_write_raw(&self, at: u32, val: u32) {
            self.inner.borrow_mut().stack.write_raw(at, val);
        }

        pub fn stack_write(&self, at: u32, val: i32) {
            self.inner.borrow_mut().stack.write(at, val);
        }

        pub fn stack_read_raw(&self, at: u32) -> u32 {
            self.inner.borrow().stack.read_raw(at).unwrap_or(0)
        }

        pub fn stack_read(&self, at: u32) -> i32 {
            self.inner.borrow().stack.read(at).unwrap_or(0)
        }

        pub fn stack_reset(&self) {
            self.inner.borrow_mut().stack.reset();
        }
    }
}
