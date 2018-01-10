use gbox::GBox;
use to_u32;
use track::Tracked;

const NODE_SIZE: usize = 4096;

pub struct Stack {
    head: Option<Box<Node>>,
    fp: i32,
    sp: i32,
    _tracked: Tracked,
}

struct Node {
    data: [u32; NODE_SIZE],
    next: Option<Box<Node>>,
}

const NUMBER: u32 = 0b000;
const NEGATIVE: u32 = 0b100;
const MASK: u32 = 0b111;

fn decode(val: u32) -> i32 {
    let payload = val >> 3;
    match val & MASK {
        NUMBER => payload as i32,
        NEGATIVE => -(payload as i32),
        _ => 0, // TODO: panic?
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

    pub fn push_smi(&mut self, val: i32) {
        self.sp += 1;
        let pos = to_u32(self.sp);
        self.write(pos, val)
    }

    pub fn pop_smi(&mut self) -> i32 {
        let ret = self.read(to_u32(self.sp));
        self.sp -= 1;
        debug_assert!(ret.is_some()); // this should be an in-bounds read
        ret.unwrap_or(0)
    }

    pub fn get_smi(&mut self, offset: u32) -> i32 {
        let ret = self.read(to_u32(self.fp) + offset);
        debug_assert!(ret.is_some()); // this should be an in-bounds read
        ret.unwrap_or(0)
    }

    pub fn pop(&mut self, count: i32) {
        self.sp -= count;
    }

    pub fn dup(&mut self, from: i32) {
        let to = self.sp + 1;
        drop(self.copy(to_u32(from), to_u32(to)));
        self.sp = to;
    }

    pub fn copy(&mut self, from: u32, to: u32) -> Result<(), ()> {
        let val = match self.read_raw(from) {
            Some(val) => val,
            None => return Err(()),
        };
        self.write_raw(to, val);
        Ok(())
    }

    pub fn write(&mut self, at: u32, val: i32) {
        self.write_raw(at, GBox::i32(val).bits())
    }

    pub fn write_raw(&mut self, at: u32, val: u32) {
        let mut cur = &mut self.head;
        let mut at = at as usize;
        loop {
            let tmp = cur;
            let me = tmp.get_or_insert_with(node);
            if at < NODE_SIZE {
                me.data[at] = val;
                return
            }
            at -= NODE_SIZE;
            cur = &mut me.next;
        }
    }

    pub fn read(&self, at: u32) -> Option<i32> {
        Some(decode(self.read_raw(at)?))
    }

    pub fn read_raw(&self, at: u32) -> Option<u32> {
        let mut cur = &self.head;
        let mut at = at as usize;
        loop {
            let tmp = cur;
            let me = tmp.as_ref()?;
            if at < NODE_SIZE {
                return Some(me.data[at])
            }
            at -= NODE_SIZE;
            cur = &me.next;
        }
    }

    pub fn reset(&mut self) {
        self.head = None;
    }
}

fn node() -> Box<Node> {
    Box::new(Node {
        data: [0; NODE_SIZE],
        next: None,
    })
}
