use std::mem;

use gbox::GBox;

pub struct Encoder {
    instructions: Box<[u32]>,
    offset: usize,
}

// Be sure to keep these in sync with `executor.ts`
const PUSH: u32 = 0;
const APPEND_TEXT: u32 = 1;
const APPEND_COMMENT: u32 = 2;
const OPEN_ELEMENT: u32 = 3;
const PUSH_REMOTE_ELEMENT: u32 = 4;
const POP_REMOTE_ELEMENT: u32 = 5;
const UPDATE_WITH_REFERENCE: u32 = 6;

impl Encoder {
    pub fn new() -> Encoder {
        Encoder {
            instructions: Box::new([0; 2048]),
            offset: 0,
        }
    }

    pub fn encode(&mut self, inst: u32, op1: GBox, op2: GBox) {
        if self.offset + 3 >= self.instructions.len() {
            self.grow();
        }
        let range = self.offset..self.offset + 3;
        let slice = match self.instructions.get_mut(range) {
            Some(i) => i,
            None => panic!("overflowed instruction builder array"),
        };
        slice[0] = inst;
        slice[1] = op1.bits();
        slice[2] = op2.bits();
        self.offset += 3;
    }

    fn grow(&mut self) {
        panic!("need to figure out how to grow an array without pulling in \
                code from std that panics...")
    }

    pub fn as_ptr(&self) -> *const u32 {
        self.instructions.as_ptr()
    }

    pub fn finalize(&mut self) -> usize {
        mem::replace(&mut self.offset, 0)
    }

    pub fn append_text(&mut self, text: GBox) {
        self.encode(APPEND_TEXT, text, GBox::undefined());
    }

    pub fn append_comment(&mut self, text: GBox) {
        self.encode(APPEND_COMMENT, text, GBox::undefined())
    }

    pub fn open_element(&mut self, tag_name: GBox) {
        self.encode(OPEN_ELEMENT, tag_name, GBox::undefined())
    }

    pub fn push_remote_element(&mut self,
                               element: GBox,
                               guid: GBox,
                               next_sibling: GBox) {
        self.encode(PUSH, next_sibling, GBox::undefined());
        self.encode(PUSH_REMOTE_ELEMENT, element, guid);
    }

    pub fn pop_remote_element(&mut self) {
        self.encode(POP_REMOTE_ELEMENT, GBox::undefined(), GBox::undefined())
    }

    pub fn update_with_reference(&mut self, reference: GBox) {
        self.encode(UPDATE_WITH_REFERENCE, reference, GBox::undefined())
    }
}
