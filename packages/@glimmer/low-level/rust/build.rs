use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;

fn main() {
    let mut contents = String::new();
    let cwd = env::current_dir().unwrap();

    // We want to find a path in the original source tree to parse that and
    // print out the same opcodes in Rust. Most of the time we're symlinked so
    // we'll find it relative to the actual `rust` source directory, but on
    // platforms like Windows broccoli will put us into a temporary build
    // directory. If that's the case try a few candidates to find this file to
    // see which works.
    let path1 = PathBuf::from("../../vm/lib/opcodes.ts");
    let path2 = cwd.join("../../packages/@glimmer/vm/lib/opcodes.ts");
    let path = if path1.exists() {
        path1
    } else {
        assert!(path2.exists());
        path2
    };
    println!("cargo:rerun-if-changed={}", path.display());
    File::open(&path).unwrap()
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
    contents.push_str("#[repr(u16)]\n");
    contents.push_str("#[allow(dead_code)]\n");
    contents.push_str("#[derive(Debug, Copy, Clone)]\n");
    contents.push_str("pub enum Op {\n");
    for (i, v) in variants.iter().enumerate() {
        contents.push_str(&format!("    {} = {},\n", v, i));
    }
    contents.push_str("}\n");

    let mut dst = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    dst.push("op.rs");
    File::create(&dst).unwrap().write_all(contents.as_bytes()).unwrap();
}
