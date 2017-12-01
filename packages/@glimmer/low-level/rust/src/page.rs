use std::ptr;

pub const PAGE_SIZE: usize = 64 * 1024;
pub type Page = [u8; PAGE_SIZE];

static mut NEXT_FREE: *mut List = 0 as *mut _;

struct List {
    next: *mut List,
}

extern {
    #[link_name = "llvm.wasm.current.memory.i32"]
    fn current_memory() -> u32;

    // TODO: this intrinsic actually returns the previous limit, but LLVM
    // doesn't expose that right now. When we upgrade LLVM stop using
    // `current_memory` above.
    #[link_name = "llvm.wasm.grow.memory.i32"]
    fn grow_memory(pages: u32);
}

pub fn alloc() -> *mut Page {
    unsafe {
        if NEXT_FREE.is_null() {
            let cur = current_memory() as usize;
            grow_memory(1);
            if cur == current_memory() as usize {
                ptr::null_mut()
            } else {
                (cur * PAGE_SIZE) as *mut Page
            }
        } else {
            let ret = NEXT_FREE;
            NEXT_FREE = (*ret).next;
            ret as *mut Page
        }
    }
}

pub unsafe fn free(page: *mut Page) {
    let page = page as *mut List;
    (*page).next = NEXT_FREE;
    NEXT_FREE = page;
}
