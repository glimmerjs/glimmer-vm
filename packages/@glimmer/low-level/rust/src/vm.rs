use std::rc::Rc;

use wasm_bindgen::prelude::*;

use ffi;
use gbox::GBox;
use heap::Heap;
use my_ref_cell::MyRefCell;
use opcode::{Opcode, Op};
use stack::Stack;
use track::Tracked;
use to_u32;

pub struct VM {
    stack: Stack,

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
    fn new() -> VM {
        let stack = Stack::new(0, -1);
        VM {
            pc: -1,
            ra: -1,
            current_op_size: 0,
            stack: stack,
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
        self.stack.push(GBox::i32(self.ra));
        let fp = self.stack.fp();
        self.stack.push(GBox::i32(fp));
        let sp = self.stack.sp();
        self.stack.set_fp(sp - 1);
    }

    // Restore $ra, $sp and $fp
    fn pop_frame(&mut self) {
        let fp = self.stack.fp();
        self.stack.set_sp(fp - 1);
        self.ra = self.stack.get(0).unwrap_i32();
        let fp = self.stack.get(1).unwrap_i32();
        self.stack.set_fp(fp);
    }

    // Jump to an address in the program
    fn goto(&mut self, offset: i32) {
        self.pc = self.pc + offset - self.current_op_size;
    }

    // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
    fn call(&mut self, handle: u32, heap: &mut Heap) {
        self.ra = self.pc;
        self.pc = heap.get_addr(handle);
    }

    // Put a specific `program` address in $ra
    fn return_to(&mut self, offset: i32) {
        self.ra = self.pc + offset - self.current_op_size;
    }

    // Return to the `program` address stored in $ra
    fn return_(&mut self) {
        self.pc = self.ra;
    }

    fn next_statement(&mut self, heap: &mut Heap) -> Option<Opcode> {
        if self.pc == -1 {
            return None
        }

        // We have to save off the current operations size so that
        // when we do a jump we can calculate the correct offset
        // to where we are going. We can't simply ask for the size
        // in a jump because we have have already incremented the
        // program counter to the next instruction prior to executing.
        let opcode = Opcode::new(to_u32(self.pc));
        self.current_op_size = opcode.size(heap).into();
        self.pc = self.pc + self.current_op_size;
        Some(opcode)
    }

    fn evaluate(&mut self, opcode: Opcode, heap: &mut Heap) -> bool {
        match opcode.op(heap) {
            Op::PushFrame => self.push_frame(),
            Op::PopFrame => self.pop_frame(),
            Op::InvokeStatic => {
                let op1 = opcode.op1(heap);
                self.call(op1.into(), heap)
            }
            Op::InvokeVirtual => {
                let addr = self.stack.pop(1).unwrap_i32();
                self.call(to_u32(addr), heap)
            }
            Op::Jump => {
                let op1 = opcode.op1(heap).into();
                self.goto(op1)
            }
            Op::Return => self.return_(),
            Op::ReturnTo => {
                let op1 = opcode.op1(heap).into();
                self.return_to(op1)
            }

            Op::Pop => {
                let count = opcode.op1(heap);
                self.stack.pop(count.into());
            }

            Op::Dup => {
                let register = opcode.op1(heap) as usize;
                let offset: i32 = opcode.op2(heap).into();

                let position = self.register(register).unwrap_i32() - offset;
                self.stack.dup(position);
            }

            Op::Load => {
                let register = opcode.op1(heap) as usize;
                let value = self.stack.pop(1);
                self.set_register(register, value);
            }

            Op::Fetch => {
                let register = opcode.op1(heap) as usize;
                let value = self.register(register);
                self.stack.push(value);
            }

            op => {
                debug_assert!(!opcode.is_machine(heap),
                              "bad opcode {:?}", op);
                return false
            }
        }

        true
    }
}

wasm_bindgen! {
    pub struct LowLevelVM {
        inner: MyRefCell<VM>,
        heap: Rc<MyRefCell<Heap>>,
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
                inner: MyRefCell::new(VM::new()),
                devmode,
                syscalls,
                externs,
                heap: Rc::new(MyRefCell::new(Heap::new(heap))),
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
            self.inner.borrow_mut().call(handle, &mut *self.heap.borrow_mut())
        }

        pub fn evaluate_all(&self, vm: &JsObject) {
            while self.evaluate_one(vm) {
                // ...
            }
        }

        pub fn evaluate_one(&self, vm: &JsObject) -> bool {
            let next = {
                let mut heap = self.heap.borrow_mut();
                self.inner.borrow_mut().next_statement(&mut *heap)
            };
            let opcode = match next {
                Some(opcode) => opcode,
                None => return false,
            };

            let state = if self.devmode {
                Some(ffi::low_level_vm_debug_before(&self.externs, opcode.offset()))
            } else {
                None
            };

            let complete = self.inner.borrow_mut().evaluate(
                opcode,
                &mut *self.heap.borrow_mut(),
            );
            if !complete {
                ffi::low_level_vm_evaluate_syscall(&self.syscalls,
                                                   vm,
                                                   opcode.offset())
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
            self.inner.borrow_mut().stack.write(at, GBox::from_bits(val));
        }

        pub fn stack_write(&self, at: u32, val: i32) {
            self.inner.borrow_mut().stack.write(at, GBox::i32(val));
        }

        pub fn stack_read_raw(&self, at: u32) -> u32 {
            self.inner.borrow().stack.read(at)
                .map(|g| g.bits())
                .unwrap_or(0)
        }

        pub fn stack_read(&self, at: u32) -> i32 {
            self.inner.borrow().stack.read(at)
                .map(|g| g.unwrap_i32())
                .unwrap_or(0)
        }

        pub fn stack_reset(&self) {
            self.inner.borrow_mut().stack.reset();
        }
    }
}
