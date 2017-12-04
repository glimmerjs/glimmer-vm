use std::mem;

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
        Stack { head: page::alloc() as *mut Node }
    }

    pub fn into_usize(self) -> usize {
        self.head as usize
    }

    pub unsafe fn free_usize(stack: usize) {
        drop(Stack { head: stack as *mut Node });
    }

    pub unsafe fn with_stack<F, R>(stack: usize, f: F) -> R
        where F: FnOnce(&mut Stack) -> R
    {
        let mut tmp = Stack { head: stack as *mut Node };
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
            while at >= (*cur).data.len() {
                at -= (*cur).data.len();
                if (*cur).next.is_null() {
                    (*cur).next = page::alloc() as *mut Node;
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
            let mut cur = self.head;
            while !cur.is_null() {
                for slot in (*cur).data.iter_mut() {
                    *slot = 0;
                }
                cur = (*cur).next;
            }
        }
    }
}

impl Clone for Stack {
    fn clone(&self) -> Stack {
        unsafe {
            let ret = Stack { head: page::alloc() as *mut Node };
            let mut a = ret.head;
            let mut b = self.head;
            loop {
                (*a).data = (*b).data;
                if (*b).next.is_null() {
                    break
                }
                b = (*b).next;
                (*a).next = page::alloc() as *mut Node;
                a = (*a).next;
            }
            return ret
        }
    }
}

impl Drop for Stack {
    fn drop(&mut self) {
        unsafe {
            let mut cur = self.head;
            while !cur.is_null() {
                let next = (*cur).next;
                page::free(cur as *mut page::Page);
                cur = next;
            }
        }
    }
}
