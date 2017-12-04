//! Small reimplementation of `std::boxed::BigBox` but using a page-per-allocation.
//!
//! Super inefficient, don't make lots. Super small code though!
//!
//! TODO: remove this with a more efficient allocator or just use `Box`.

use std::mem;
use std::ops::{Deref, DerefMut};
use std::ptr;

use page::{self, Page};

pub struct BigBox<T>(*mut T);

impl<T> BigBox<T> {
    pub fn new(t: T) -> BigBox<T> {
        assert!(mem::size_of::<T>() <= page::PAGE_SIZE);
        unsafe {
            let ptr = page::alloc() as *mut T;
            ptr::write(ptr, t);
            BigBox::from_raw(ptr)
        }
    }

    pub fn into_raw(t: BigBox<T>) -> *mut T {
        let ret = t.0;
        mem::forget(t);
        return ret
    }

    pub unsafe fn from_raw(t: *mut T) -> BigBox<T> {
        BigBox(t)
    }
}

impl<T> Deref for BigBox<T> {
    type Target = T;
    fn deref(&self) -> &T {
        unsafe { &*self.0 }
    }
}

impl<T> DerefMut for BigBox<T> {
    fn deref_mut(&mut self) -> &mut T {
        unsafe { &mut *self.0 }
    }
}

impl<T> Drop for BigBox<T> {
    fn drop(&mut self) {
        unsafe {
            ptr::drop_in_place(self.0);
            page::free(self.0 as *mut Page);
        }
    }
}
