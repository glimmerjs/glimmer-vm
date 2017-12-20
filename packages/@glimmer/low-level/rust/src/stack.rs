use core::mem;
use core::ptr;

use page;

pub struct Stack {
    head: *mut Node,
}

struct Node {
    next: *mut Node,
    data: [u32; page::PAGE_SIZE / 8 - 1],
}

const NUMBER: u32 = 0b000;
const NEGATIVE: u32 = 0b100;
const MASK: u32 = 0b111;

fn encode(val: i32) -> u32 {
    let (val, flags) = if val < 0 {
        ((-val) as u32, NEGATIVE)
    } else {
        (val as u32, NUMBER)
    };
    debug_assert!(val & (0b111 << 29) == 0);
    (val << 3) | flags
}

fn decode(val: u32) -> i32 {
    let payload = val >> 3;
    match val & MASK {
        NUMBER => payload as i32,
        NEGATIVE => -(payload as i32),
        _ => 0, // TODO: panic?
    }
}

impl Stack {
    pub fn new() -> Stack {
        Stack { head: node() }
    }

    pub fn into_usize(self) -> usize {
        let ret = self.as_usize();
        mem::forget(self);
        return ret
    }

    pub fn as_usize(&self) -> usize {
        self.head as usize
    }

    pub unsafe fn from_usize(stack: usize) -> Stack {
        Stack { head: stack as *mut Node }
    }

    pub unsafe fn with_stack<F, R>(stack: usize, f: F) -> R
        where F: FnOnce(&mut Stack) -> R
    {
        let mut tmp = Stack::from_usize(stack);
        let ret = f(&mut tmp);
        mem::forget(tmp);
        return ret
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
        self.write_raw(at, encode(val))
    }

    pub fn write_raw(&mut self, at: u32, val: u32) {
        unsafe {
            let mut at = at as usize;
            let mut cur = self.head;
            debug_assert!(!cur.is_null());
            while at >= (*cur).data.len() {
                at -= (*cur).data.len();
                if (*cur).next.is_null() {
                    (*cur).next = node();
                }
                cur = (*cur).next;
            }
            (*cur).data[at] = val;
        }
    }

    pub fn read(&self, at: u32) -> Option<i32> {
        Some(decode(self.read_raw(at)?))
    }

    pub fn read_raw(&self, at: u32) -> Option<u32> {
        unsafe {
            let mut at = at as usize;
            let mut cur = self.head;
            debug_assert!(!cur.is_null());
            while at >= (*cur).data.len() {
                at -= (*cur).data.len();
                cur = (*cur).next;
                if cur.is_null() {
                    return None
                }
            }
            Some((*cur).data[at])
        }
    }

    pub fn reset(&mut self) {
        unsafe {
            free_node((*self.head).next);
        }
    }
}

fn node() -> *mut Node {
    assert!(mem::size_of::<Node>() <= page::PAGE_SIZE);
    unsafe {
        let page = page::alloc() as *mut Node;
        (*page).next = ptr::null_mut();
        return page
    }
}

unsafe fn free_node(mut node: *mut Node) {
    while !node.is_null() {
        let next = (*node).next;
        page::free(node as *mut page::Page);
        node = next;
    }
}

impl Drop for Stack {
    fn drop(&mut self) {
        unsafe {
            free_node(self.head);
        }
    }
}
