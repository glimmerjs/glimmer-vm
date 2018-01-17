use gbox::GBox;
use to_u32;
use track::Tracked;
use util;

const NODE_SIZE: usize = 4096;

pub struct Stack {
    head: Option<Box<Node>>,
    fp: i32,
    sp: i32,
    _tracked: Tracked,
}

linked_list_node! {
    struct Node {
        data: [u32 = 0; NODE_SIZE],
    }
}

impl Stack {
    pub fn new(fp: i32, sp: i32) -> Stack {
        Stack {
            head: None,
            fp,
            sp,
            _tracked: Tracked::new(),
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

    pub fn push(&mut self, val: GBox) {
        self.sp += 1;
        let pos = to_u32(self.sp);
        self.write(pos, val)
    }

    pub fn pop(&mut self, count: i32) -> GBox {
        let top = self.read(to_u32(self.sp));
        self.sp -= count;
        return top.unwrap_or(GBox::null())
    }

    pub fn dup(&mut self, from: i32) {
        let to = self.sp + 1;
        drop(self.copy(to_u32(from), to_u32(to)));
        self.sp = to;
    }

    pub fn get(&mut self, offset: u32) -> GBox {
        self.read(to_u32(self.fp) + offset)
            .unwrap_or(GBox::i32(0))
    }

    pub fn copy(&mut self, from: u32, to: u32) -> Result<(), ()> {
        let val = match self.read(from) {
            Some(val) => val,
            None => return Err(()),
        };
        self.write(to, val);
        Ok(())
    }

    pub fn write(&mut self, at: u32, val: GBox) {
        util::list_write(&mut self.head, at, val.bits());
    }

    pub fn read(&self, at: u32) -> Option<GBox> {
        util::list_read(&self.head, at).cloned().map(GBox::from_bits)
    }

    pub fn reset(&mut self) {
        self.head = None;
    }
}
