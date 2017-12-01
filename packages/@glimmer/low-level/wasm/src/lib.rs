#![feature(lang_items)]
#![no_std]

#[lang = "panic_fmt"]
#[no_mangle]
pub extern fn panic_fmt() -> ! { loop {} }

pub mod fibonacci;
