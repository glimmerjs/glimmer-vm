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
    handle: u32,
}

impl Heap {
    pub fn new(handle: u32) -> Heap {
        Heap { handle }
    }

    pub fn get_addr(&self, at: u32) -> i32 {
        unsafe {
            ffi::low_level_vm_heap_get_addr(self.handle, at)
        }
    }

    pub fn get_by_addr(&self, at: u32) -> u32 {
        unsafe {
            ffi::low_level_vm_heap_get_by_addr(self.handle, at)
        }
    }
}

pub struct Program {
    handle: u32,
}

impl Program {
    pub fn new(handle: u32) -> Program {
        Program { handle }
    }

    pub fn opcode(&self, offset: u32) -> Opcode {
        let offset = unsafe {
            ffi::low_level_vm_program_opcode(self.handle, offset)
        };
        Opcode::new(offset)
    }
}

pub struct LowLevelVM {
    // Right now these are encoded as `i32` because the "exit" address is
    // encoded as -1, but these may wish to change in the future to a `u32`
    // representation.
    pc: i32,
    ra: i32,
    current_op_size: i32,
    stack: Stack,
    heap: Heap,
    program: Program,
}

impl LowLevelVM {
    pub fn new(heap: Heap, program: Program, stack: Stack) -> LowLevelVM {
        LowLevelVM {
            pc: -1,
            ra: -1,
            current_op_size: 0,
            stack,
            heap,
            program,
        }
    }

    pub fn stack(&self) -> &Stack {
        &self.stack
    }

    pub fn current_op_size(&self) -> u32 {
        to_u32(self.current_op_size)
    }

    pub fn ra(&self) -> i32 {
        self.ra
    }

    pub fn set_ra(&mut self, ra: i32) {
        self.ra = ra;
    }

    pub fn pc(&self) -> i32 {
        self.pc
    }

    pub fn set_pc(&mut self, pc: i32) {
        self.pc = pc;
    }

    pub fn fp(&self) -> i32 {
        self.stack.fp()
    }

    pub fn set_fp(&mut self, fp: i32) {
        self.stack.set_fp(fp);
    }

    pub fn sp(&self) -> i32 {
        self.stack.sp()
    }

    pub fn set_sp(&mut self, sp: i32) {
        self.stack.set_sp(sp);
    }

    // Start a new frame and save $ra and $fp on the stack
    pub fn push_frame(&mut self) {
        self.stack.push_smi(self.ra);
        let fp = self.stack.fp();
        self.stack.push_smi(fp);
        let sp = self.stack.sp();
        self.stack.set_fp(sp - 1);
    }

    // Restore $ra, $sp and $fp
    pub fn pop_frame(&mut self) {
        let fp = self.stack.fp();
        self.stack.set_sp(fp - 1);
        self.ra = self.stack.get_smi(0);
        let fp = self.stack.get_smi(1);
        self.stack.set_fp(fp);
    }

    // Jump to an address in the program
    pub fn goto(&mut self, offset: i32) {
        self.pc = self.pc + offset - self.current_op_size;
    }

    // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
    pub fn call(&mut self, handle: u32) {
        self.ra = self.pc;
        self.pc = self.heap.get_addr(handle);
    }

    // Put a specific `program` address in $ra
    pub fn return_to(&mut self, offset: i32) {
        self.ra = self.pc + offset - self.current_op_size;
    }

    // Return to the `program` address stored in $ra
    pub fn return_(&mut self) {
        self.pc = self.ra;
    }

    pub fn next_statement(&mut self) -> Option<Opcode> {
        if self.pc == -1 {
            return None
        }

        // We have to save off the current operations size so that
        // when we do a jump we can calculate the correct offset
        // to where we are going. We can't simply ask for the size
        // in a jump because we have have already incremented the
        // program counter to the next instruction prior to executing.
        let opcode = self.program.opcode(to_u32(self.pc));
        self.current_op_size = to_i32(opcode.size(&self.heap));
        self.pc += self.current_op_size;
        Some(opcode)
    }

    pub fn evaluate_outer(&mut self, opcode: Opcode, vm: u32) {
        let state = if cfg!(debug_assertions) || true /* needed for tests? */ {
            Some(unsafe {
                ffi::low_level_vm_debug_before(opcode.offset())
            })
        } else {
            None
        };

        self.evaluate_inner(opcode, vm);

        if let Some(state) = state {
            unsafe {
                ffi::low_level_vm_debug_after(state, opcode.offset());
            }
        }
    }

    fn evaluate_inner(&mut self, opcode: Opcode, vm: u32) {
        if opcode.is_machine(&self.heap) {
            self.evaluate_machine(opcode)
        } else {
            self.evaluate_syscall(opcode, vm)
        }
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

    fn evaluate_syscall(&mut self, opcode: Opcode, vm: u32) {
        unsafe {
            ffi::low_level_vm_evaluate_syscall(vm, opcode.offset())
        }
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
