use std::sync::atomic::*;

static NUM: AtomicUsize = ATOMIC_USIZE_INIT;

pub struct Tracked(());

impl Tracked {
    pub fn new() -> Tracked {
        NUM.fetch_add(1, Ordering::SeqCst);
        Tracked(())
    }
}

impl Drop for Tracked {
    fn drop(&mut self) {
        NUM.fetch_sub(1, Ordering::SeqCst);
    }
}

pub fn total() -> usize {
    NUM.load(Ordering::SeqCst)
}
