// JS bindings for the a "glimmer box" which is used to transmit arbitrary
// values back and forth from the glimmer runtime to the wasm runtime. A
// `Context` can encode any JS value into a 32-bit number, and can then decode
// that number back into the original value.
//
// Note that the encoding/decoding here needs to stay in sync with Rust/wasm.
// This same class is implemented as `GBox` in Rust and the encodings need to
// agree.

import { assert } from '@glimmer/util';

// Note that these need to stay in sync with `constants.ts`
//
// TODO: this shouldn't have to stay in sync w/ elsewhere, are these getting
// mixed up by accident
enum Tag {
  NUMBER          = 0b000,
  BOOLEAN_OR_VOID = 0b011,
  NEGATIVE        = 0b100,
  ANY             = 0b101,
}

const TAG_SIZE = 3;
const TAG_MASK = (1 << TAG_SIZE) - 1;

// TODO: these are special values that can't be changed, presumably need to say
// in sync with those in `opcode-builder.ts`? These should be deduplicated?
enum Immediates {
  False = 0 << TAG_SIZE | Tag.BOOLEAN_OR_VOID,
  True  = 1 << TAG_SIZE | Tag.BOOLEAN_OR_VOID,
  Null  = 2 << TAG_SIZE | Tag.BOOLEAN_OR_VOID,
  Undef = 3 << TAG_SIZE | Tag.BOOLEAN_OR_VOID
}

export class Context {
  // TODO: `pop` is never called on this, but it's a stack...
  constructor(private stack: any[] = []) {}

  nullValue(): number {
    return Immediates.Null;
  }

  encode(a: any): number {
    switch (typeof a) {
      case 'number':
        if (a as number % 1 === 0)
          return this.encodeSmi(a as number);
        break;
      case 'boolean':
        return a ? Immediates.True : Immediates.False;
      case 'object':
        if (a === null)
          return Immediates.Null;
        break;
      case 'undefined':
        return Immediates.Undef;
      default:
        break;
    }
    return this.encodeObject(a);
  }

  decode(a: number): any {
    switch (a & TAG_MASK) {
        case Tag.NUMBER:
          return a >> TAG_SIZE;
        case Tag.NEGATIVE:
          return -(a >> TAG_SIZE);
        case Tag.BOOLEAN_OR_VOID:
          switch (a) {
              case Immediates.False:
                return false;
              case Immediates.True:
                return true;
              case Immediates.Null:
                return null;
              case Immediates.Undef:
                break;
              default:
                break;
          }
          return undefined;
        case Tag.ANY:
          break;
        default:
          break;
    }

    return this.stack[a >> TAG_SIZE];
  }

  private encodeSmi(primitive: number) {
    let tag = Tag.NUMBER;
    if (primitive < 0) {
      primitive = Math.abs(primitive);
      tag = Tag.NEGATIVE;
    }
    return this.encodeNumberAndTag(primitive, tag);
  }

  private encodeObject(a: any): number {
    const idx = this.stack.length;
    this.stack.push(a);
    return this.encodeNumberAndTag(idx, Tag.ANY);
  }

  private encodeNumberAndTag(a: number, tag: number): number {
    assert(a < (1 << (32 - TAG_SIZE)), 'number too big');
    return (a << TAG_SIZE) | tag;
  }
}
