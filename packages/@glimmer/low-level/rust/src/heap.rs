use std::cmp;
use std::rc::Rc;

use wasm_bindgen::prelude::*;

use my_ref_cell::MyRefCell;
use track::Tracked;
use util;

enum State {
    Allocated,
    Freed,
    Purged,
    Pointer,
}

fn encode_table_info(size: u32, scope_size: u32, state: State) -> u32 {
    size | (scope_size << 16) | ((state as u32) << 30)
}

fn change_state(info: u32, new: State) -> u32 {
    (info & !STATE_MASK) | ((new as u32) << 30)
}

const ENTRY_SIZE: u32 = 2;
const INFO_OFFSET: u32 = 1;
const MAX_SIZE: u16 = 0b1111111111111111;
const SIZE_MASK: u32 =  0b00000000000000001111111111111111;
const SCOPE_MASK: u32 = 0b00111111111111110000000000000000;
const STATE_MASK: u32 = 0b11000000000000000000000000000000;

pub struct Heap {
    heap: Box<[u16]>,
    table: Option<Box<Node>>,
    table_len: u32,
    offset: u32,
    handle: u32,
    _tracked: Tracked,
}

linked_list_node! {
    struct Node {
        data: [u32 = 0; 64],
    }
}

impl Heap {
    pub fn new() -> Heap {
        Heap {
            heap: Box::new([]),
            table: None,
            table_len: 0,
            offset: 0,
            handle: 0,
            _tracked: Tracked::new(),
        }
    }

    pub fn push(&mut self, item: u16) {
        let offset = self.offset;
        self.set_by_addr(offset, item);
        self.offset += 1;
    }

    pub fn get_by_addr(&self, at: u32) -> u16 {
        let val = self.get_ref(at as usize).map(|x| *x);
        val.unwrap_or(0)
    }

    pub fn set_by_addr(&mut self, at: u32, item: u16) {
        let pos = self.get_mut(at as usize);
        debug_assert!(pos.is_some());
        if let Some(pos) = pos {
            *pos = item;
        }
    }

    pub fn malloc_handle(&mut self) -> u32 {
        let table_len = self.table_len;
        let offset = self.offset;
        self.table_write_raw(table_len, offset);
        self.table_write_raw(table_len + 1, 0);
        self.table_len += 2;
        let ret = self.handle;
        self.handle += ENTRY_SIZE;
        return ret
    }

    pub fn finish_malloc(&mut self, handle: u32, scope_size: u32) {
        let start = self.table_read_raw(handle);
        let finish = self.offset;
        let instruction_size = finish - start;
        let info = encode_table_info(instruction_size, scope_size, State::Allocated);
        self.table_write_raw(handle + INFO_OFFSET, info);
    }

    pub fn size(&self) -> u32 {
        self.offset
    }

    pub fn get_addr(&self, at: u32) -> i32 {
        let ret = self.table_read_raw(at);
        debug_assert!(ret <= i32::max_value() as u32);
        ret as i32
    }

    pub fn get_handle(&mut self, address: u32) -> u32 {
        let table_len = self.table_len;
        self.table_write_raw(table_len, address);
        self.table_write_raw(table_len + 1,
                             encode_table_info(0, 0, State::Pointer));
        self.table_len += 2;
        let ret = self.handle;
        self.handle += ENTRY_SIZE;
        return ret
    }

    pub fn size_of(&self, handle: u32) -> i32 {
        if !cfg!(debug_assertions) {
            return -1
        }
        let info = self.table_read_raw(handle + INFO_OFFSET);
        (info & SIZE_MASK) as i32
    }

    pub fn scope_size_of(&self, handle: u32) -> u32 {
        let info = self.table_read_raw(handle + INFO_OFFSET);
        (info & SCOPE_MASK) >> 16
    }

    pub fn free_handle(&mut self, handle: u32) {
        let info = self.table_read_raw(handle + INFO_OFFSET);
        self.table_write_raw(handle + INFO_OFFSET, change_state(info, State::Freed));
    }

    /// The heap uses the [Mark-Compact Algorithm](https://en.wikipedia.org/wiki/Mark-compact_algorithm) to shift
    /// reachable memory to the bottom of the heap and freeable
    /// memory to the top of the heap. When we have shifted all
    /// the reachable memory to the top of the heap, we move the
    /// offset to the next free position.
    pub fn compact(&mut self) {
        let mut compacted_size = 0;

        for i in (0..self.table_len / 2).map(|i| 2 * i) {
            let offset = self.table_read_raw(i);
            let info = self.table_read_raw(i + INFO_OFFSET);
            let size = info & SIZE_MASK;
            let state = (info & STATE_MASK) >> 30;

            if state == State::Purged as u32 {
                continue
            } else if state == State::Freed as u32 {
                // transition to "already freed" aka "purged"
                // a good improvement would be to reuse
                // these slots
                self.table_write_raw(i + INFO_OFFSET,
                                     change_state(info, State::Purged));
                compacted_size += size;
            } else if state == State::Allocated as u32 {
                for j in offset..i + size + 1{
                    let val = self.get_by_addr(j);
                    self.set_by_addr(j - compacted_size, val);
                }

                self.table_write_raw(i, offset - compacted_size);
            } else if state == State::Pointer as u32 {
                self.table_write_raw(i, offset - compacted_size);
            } else {
                debug_assert!(false, "bad state");
            }
        }

        self.offset -= compacted_size;
    }

    pub fn push_placeholder(&mut self) -> u32 {
        let address = self.offset;
        self.offset += 1;
        self.set_by_addr(address, MAX_SIZE);
        return address
    }

    pub fn table_read_raw(&self, pos: u32) -> u32 {
        match util::list_read(&self.table, pos) {
            Some(i) => *i,
            None => panic!("out of bound read on table"),
        }
    }

    pub fn table_write_raw(&mut self, pos: u32, val: u32) {
        util::list_write(&mut self.table, pos, val);
    }

    pub fn reserve(&mut self, size: u32) -> *mut u16 {
        // don't let heap sizes get too too big
        let size = cmp::min(size, u32::max_value() / 16) as usize;
        self.heap = vec![0; size].into_boxed_slice();
        self.heap.as_mut_ptr()
    }

    fn get_ref(&self, at: usize) -> Option<&u16> {
        self.heap.get(at)
    }

    fn get_mut(&mut self, at: usize) -> Option<&mut u16> {
        self.heap.get_mut(at)
    }
}

#[wasm_bindgen]
pub struct WasmHeap(pub Rc<MyRefCell<Heap>>);

#[wasm_bindgen]
impl WasmHeap {
    pub fn new() -> WasmHeap {
        WasmHeap(Rc::new(MyRefCell::new(Heap::new())))
    }

    pub fn push(&self, item: u16) {
        self.0.borrow_mut().push(item)
    }

    pub fn get_by_addr(&self, at: u32) -> u16 {
        self.0.borrow_mut().get_by_addr(at)
    }

    pub fn set_by_addr(&self, at: u32, item: u16) {
        self.0.borrow_mut().set_by_addr(at, item)
    }

    pub fn malloc_handle(&self) -> u32 {
        self.0.borrow_mut().malloc_handle()
    }

    pub fn finish_malloc(&self, handle: u32, scope_size: u32) {
        self.0.borrow_mut().finish_malloc(handle, scope_size);
    }

    pub fn size(&self) -> u32 {
        self.0.borrow().size()
    }

    pub fn get_addr(&self, at: u32) -> i32 {
        self.0.borrow().get_addr(at)
    }

    pub fn get_handle(&self, address: u32) -> u32 {
        self.0.borrow_mut().get_handle(address)
    }

    pub fn size_of(&self, handle: u32) -> i32 {
        self.0.borrow().size_of(handle)
    }

    pub fn scope_size_of(&self, handle: u32) -> u32 {
        self.0.borrow().scope_size_of(handle)
    }

    pub fn free_handle(&self, handle: u32) {
        self.0.borrow_mut().free_handle(handle)
    }

    pub fn compact(&self) {
        self.0.borrow_mut().compact()
    }

    pub fn push_placeholder(&self) -> u32 {
        self.0.borrow_mut().push_placeholder()
    }

    pub fn table_len(&self) -> u32 {
        self.0.borrow().table_len
    }

    pub fn set_table_len(&self, table_len: u32) {
        debug_assert!(table_len % 2 == 0);
        let mut heap = self.0.borrow_mut();
        heap.table_len = table_len;
    }

    pub fn table_read_raw(&self, pos: u32) -> u32 {
        self.0.borrow().table_read_raw(pos)
    }

    pub fn table_write_raw(&self, pos: u32, val: u32) {
        self.0.borrow_mut().table_write_raw(pos, val)
    }

    pub fn handle(&self) -> u32 {
        self.0.borrow().handle
    }

    pub fn heap(&self) -> *const u16 {
        self.0.borrow().heap.as_ptr()
    }

    pub fn set_handle(&self, handle: u32) {
        self.0.borrow_mut().handle = handle;
    }

    pub fn set_offset(&self, offset: u32) {
        self.0.borrow_mut().offset = offset;
    }

    pub fn reserve(&self, size: u32) -> *mut u16 {
        self.0.borrow_mut().reserve(size)
    }
}
