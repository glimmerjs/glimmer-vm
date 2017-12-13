pub const PAGE_SIZE: usize = 64 * 1024;
pub type Page = [u8; PAGE_SIZE];

static mut NEXT_FREE: *mut List = 0 as *mut _;
static mut ALLOCATED_PAGES: u32 = 0;

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
        ALLOCATED_PAGES += 1;
        if NEXT_FREE.is_null() {
            let cur = current_memory() as usize;
            grow_memory(1);
            if current_memory() as usize == cur {
                ::debug::abort();
            }
            (cur * PAGE_SIZE) as *mut Page
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
    debug_assert!(ALLOCATED_PAGES > 0);
    ALLOCATED_PAGES -= 1;
}

pub fn num_allocated() -> u32 {
    unsafe {
        ALLOCATED_PAGES
    }
}
