use std::mem;

use page;

pub struct Stack {
    head: *mut Node,
}

struct Node {
    next: *mut Node,
    data: [u64; page::PAGE_SIZE / 8 - 1],
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
        let val = match self.read(from) {
            Some(val) => val,
            None => return Err(()),
        };
        self.write(to, val)
    }

    pub fn write(&mut self, at: u32, val: u64) -> Result<(), ()> {
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
            Ok(())
        }
    }

    pub fn read(&self, at: u32) -> Option<u64> {
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

    pub fn len(&self) -> u32 {
        0 // uhh ...
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
