//! Various debugging utilities that can be useful at various times

#![allow(dead_code, unused_macros)]

use std::fmt;

use ffi;

// A `println!` macro that's redirected to `console.log` if debug assertions are
// enabled.
macro_rules! debug_println {
    ($($t:tt)*) => (::debug::_println(&format_args!($($t)*)))
}

// Override libstd's panic macro so we can hopefully get a better message by
// printing to the JS console. Note that this doesn't work for
// libstd-originating panics like `Option::unwrap`, those messages still won't
// make their way to the console, but hopefully a backtrace is good enough
// there!
macro_rules! panic {
    () => (panic!("explicit panic"));
    ($msg:expr) => (
        ::debug::_panic1(&($msg, file!(), line!()))
    );
    ($fmt:expr, $($arg:tt)*) => (
        ::debug::_panic2(&format_args!($fmt, $($arg)*), &(file!(), line!()))
    );
}

pub fn _println(a: &fmt::Arguments) {
    if !cfg!(debug_assertions) {
        return
    }

    let s = a.to_string();
    unsafe {
        ffi::debug_println(s.as_ptr(), s.len());
    }
}

#[cold]
#[inline(never)]
pub fn _panic1(&(msg, file, line): &(&'static str, &'static str, u32)) -> ! {
    debug_println!("rust panicked at: {}: {}:{}", msg, file, line);
    abort()
}

#[cold]
#[inline(never)]
pub fn _panic2(args: &fmt::Arguments, &(file, line): &(&str, u32)) -> ! {
    debug_println!("rust panicked at: {}: {}:{}", args, file, line);
    abort()
}

pub fn abort() -> ! {
    // This is a pretty bad message but we won't see it anyway, so just need to
    // panic!
    None::<u32>.unwrap();
    loop {}
}
