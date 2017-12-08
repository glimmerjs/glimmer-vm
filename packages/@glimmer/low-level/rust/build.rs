use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;

fn main() {
    let mut contents = String::new();
    println!("cargo:rerun-if-changed=../../vm/lib/opcodes.ts");
    File::open("../../vm/lib/opcodes.ts").unwrap()
        .read_to_string(&mut contents).unwrap();

    let mut variants = Vec::new();
    for line in contents.lines() {
        let line = match line.find("//") {
            Some(i) => &line[..i],
            None => line,
        };
        let line = line.trim();
        if line.ends_with(",") && !line.contains(" ") {
            variants.push(&line[..line.len() - 1]);
        }
    }

    let mut contents = String::new();
    contents.push_str("#[repr(u32)]\n");
    contents.push_str("#[derive(Debug, Copy, Clone)]\n");
    contents.push_str("pub enum Op {\n");
    for v in variants {
        contents.push_str(&format!("    {},\n", v));
    }
    contents.push_str("}\n");

    let mut dst = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    dst.push("op.rs");
    File::create(&dst).unwrap().write_all(contents.as_bytes()).unwrap();
}
