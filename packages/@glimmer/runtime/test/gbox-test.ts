import { Context } from '..';

let ctx: Context;

QUnit.module("GBox", {
  beforeEach() {
    ctx = new Context({} as any);
  }
});

QUnit.test("serializes numbers", assert => {
  assert.strictEqual(ctx.decode(ctx.encode(0)), 0);
  assert.strictEqual(ctx.decode(ctx.encode(1)), 1);
  assert.strictEqual(ctx.decode(ctx.encode(9000)), 9000);
  assert.strictEqual(ctx.decode(ctx.encode(-9000)), -9000);
});

QUnit.test("serializes booleans", assert => {
  assert.strictEqual(ctx.decode(ctx.encode(true)), true);
  assert.strictEqual(ctx.decode(ctx.encode(false)), false);
});

QUnit.test("serializes voids", assert => {
  assert.strictEqual(ctx.decode(ctx.encode(null)), null);
  assert.strictEqual(ctx.decode(ctx.encode(undefined)), undefined);
});

QUnit.test("serializes floats", assert => {
  assert.strictEqual(ctx.decode(ctx.encode(1/3)), 1/3);
  assert.strictEqual(ctx.decode(ctx.encode(999999999 / 66666666)), 999999999 / 66666666);
  assert.strictEqual(ctx.decode(ctx.encode(-999999999 / 66666666)), -999999999 / 66666666);
});

QUnit.test("serializes strings", assert => {
  assert.strictEqual(ctx.decode(ctx.encode("hello world")), "hello world");
});

QUnit.test("serializes JavaScript objects", assert => {
  let person = { firstName: "Alex", lastName: "Crichton" };
  assert.strictEqual(ctx.decode(ctx.encode(person)), person);
});
