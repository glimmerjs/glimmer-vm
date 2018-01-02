use std::cell::{Cell, UnsafeCell};
use std::ops::{Deref, DerefMut};

use wasm_bindgen;

/// A vendored version of `RefCell` from the standard library.
///
/// Now why, you may ask, would we do that? Surely `RefCell` in libstd is
/// quite good. And you're right, it is indeed quite good! Functionally
/// nothing more is needed from `MyRefCell` in the standard library but for
/// now this crate is also sort of optimizing for compiled code size.
///
/// One major factor to larger binaries in Rust is when a panic happens.
/// Panicking in the standard library involves a fair bit of machinery
/// (formatting, panic hooks, synchronization, etc). It's all worthwhile if
/// you need it but for something like `MyRefCell` here we don't actually
/// need all that!
pub struct MyRefCell<T> {
    borrow: Cell<usize>,
    value: UnsafeCell<T>,
}

impl<T> MyRefCell<T> {
    pub fn new(value: T) -> MyRefCell<T> {
        MyRefCell {
            value: UnsafeCell::new(value),
            borrow: Cell::new(0),
        }
    }

    // pub fn get_mut(&mut self) -> &mut T {
    //     unsafe {
    //         &mut *self.value.get()
    //     }
    // }

    pub fn borrow(&self) -> Ref<T> {
        unsafe {
            if self.borrow.get() == usize::max_value() {
                borrow_fail();
            }
            self.borrow.set(self.borrow.get() + 1);
            Ref {
                value: &*self.value.get(),
                borrow: &self.borrow,
            }
        }
    }

    pub fn borrow_mut(&self) -> RefMut<T> {
        unsafe {
            if self.borrow.get() != 0 {
                borrow_fail();
            }
            self.borrow.set(usize::max_value());
            RefMut {
                value: &mut *self.value.get(),
                borrow: &self.borrow,
            }
        }
    }

    // pub fn into_inner(self) -> T {
    //     unsafe {
    //         self.value.into_inner()
    //     }
    // }
}

pub struct Ref<'b, T: 'b> {
    value: &'b T,
    borrow: &'b Cell<usize>,
}

impl<'b, T> Deref for Ref<'b, T> {
    type Target = T;

    fn deref(&self) -> &T {
        self.value
    }
}

impl<'b, T> Drop for Ref<'b, T> {
    fn drop(&mut self) {
        self.borrow.set(self.borrow.get() - 1);
    }
}

pub struct RefMut<'b, T: 'b> {
    value: &'b mut T,
    borrow: &'b Cell<usize>,
}

impl<'b, T> Deref for RefMut<'b, T> {
    type Target = T;

    fn deref(&self) -> &T {
        self.value
    }
}

impl<'b, T> DerefMut for RefMut<'b, T> {
    fn deref_mut(&mut self) -> &mut T {
        self.value
    }
}

impl<'b, T> Drop for RefMut<'b, T> {
    fn drop(&mut self) {
        self.borrow.set(0);
    }
}

fn borrow_fail() -> ! {
    wasm_bindgen::throw("refcell borrow violation");
}
