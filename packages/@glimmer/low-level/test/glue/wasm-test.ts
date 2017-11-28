import { instantiate } from '@glimmer/low-level';

QUnit.module('[low-level glue] wasm');

QUnit.test('basic functionality', assert => {
  // #[no_mangle]
  // pub extern fn add_one(a: u32) -> u32 {
  //     a + 1
  // }
  let src = atob('AGFzbQEAAAABBgFgAX8BfwMCAQAEBAFwAAAFAwEAEQcUAgZtZW1vcnkCAAdhZGRf' +
                 'b25lAAAJAQAKCQEHACAAQQFqCwsKAQBBBAsEEAAQAA==');
  let enc = new TextEncoder("utf-8");
  let bytes = enc.encode(src);

  return instantiate(bytes)
  .then(module =>
    assert.strictEqual(2, module.exports.add_one(1), 'can use exports'));
});

QUnit.test('imports and exports', assert => {
  // #[no_mangle]
  // pub extern fn add_some(a: u32) -> u32 {
  //     extern { fn amt_to_add() -> u32; }
  //     a + unsafe { amt_to_add() }
  // }
  let src = atob('AGFzbQEAAAABCgJgAAF/YAF/AX8CEgEDZW52CmFtdF90b19hZGQAAAMCAQEEBAFw' +
                 'AAAFAwEAEQcVAgZtZW1vcnkCAAhhZGRfc29tZQABCQEACgkBBwAQACAAagsLCgEA' +
                 'QQQLBBAAEAA=');
  let enc = new TextEncoder("utf-8");
  let bytes = enc.encode(src);

  return instantiate(bytes, { env: { amt_to_add: () => 2 } })
  .then(module =>
    assert.strictEqual(3, module.exports.add_some(1), 'can use exports and imports'));
});
