use std::mem;

use vm::Heap;

const ARG_SHIFT: u32 = 8;
const TYPE_MASK: u32        = 0b0000000011111111;
const OPERAND_LEN_MASK: u32 = 0b0000001100000000;
const MACHINE_MASK: u32     = 0b0000010000000000;

include!(concat!(env!("OUT_DIR"), "/op.rs"));

#[derive(Clone, Copy)]
pub struct Opcode {
    offset: u32,
}

impl Opcode {
    pub fn new(offset: u32) -> Opcode {
        Opcode { offset }
    }

    pub fn offset(&self) -> u32 {
        self.offset
    }

    pub fn size(&self, heap: &Heap) -> u32 {
        let raw_type = heap.get_by_addr(self.offset);
        ((raw_type & OPERAND_LEN_MASK) >> ARG_SHIFT) + 1
    }

    pub fn is_machine(&self, heap: &Heap) -> bool {
        let raw_type = heap.get_by_addr(self.offset);
        raw_type & MACHINE_MASK != 0
    }

    pub fn op(&self, heap: &Heap) -> Op {
        let num = heap.get_by_addr(self.offset) & TYPE_MASK;
        if num >= Op::Size as u32 {
            if cfg!(debug_assertions) {
                panic!("invalid opcode type at {}: {}", self.offset, num);
            }
            Op::Bug
        } else {
            unsafe { mem::transmute(num) }
        }
    }

    pub fn op1(&self, heap: &Heap) -> u32 {
        heap.get_by_addr(self.offset + 1)
    }

    #[allow(dead_code)]
    pub fn op2(&self, heap: &Heap) -> u32 {
        heap.get_by_addr(self.offset + 2)
    }

    #[allow(dead_code)]
    pub fn op3(&self, heap: &Heap) -> u32 {
        heap.get_by_addr(self.offset + 3)
    }
}
