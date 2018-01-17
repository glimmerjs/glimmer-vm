// JS bindings for the a "glimmer box" which is used to transmit arbitrary
// values back and forth from the glimmer runtime to the wasm runtime. A
// `Context` can encode any JS value into a 32-bit number, and can then decode
// that number back into the original value.
//
// Note that the encoding/decoding here needs to stay in sync with Rust/wasm.
// This same class is implemented as `GBox` in Rust and the encodings need to
// agree.

import { assert } from '@glimmer/util';
import { DEBUG } from '@glimmer/local-debug-flags';
import { WasmLowLevelVM } from '@glimmer/low-level';
import { ComponentInstance } from "../compiled/opcodes/component";
import {
  ComponentDefinition,
  InternalComponentManager,
} from '../component/interfaces';
import {
  ProgramSymbolTable,
  ComponentInstanceState,
} from '@glimmer/interfaces';

// Note that these need to stay in sync with `constants.ts`
//
// TODO: this shouldn't have to stay in sync w/ elsewhere, are these getting
// mixed up by accident
enum Tag {
  NUMBER          = 0b000,
  BOOLEAN_OR_VOID = 0b011,
  NEGATIVE        = 0b100,
  ANY             = 0b101,
  COMPONENT       = 0b110,
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
  private stack: any[] = [];

  // TODO: `pop` is never called on this, but it's a stack...
  constructor(private wasmVM: WasmLowLevelVM) {}

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
        case Tag.COMPONENT:
          return this.decodeComponent(a >> TAG_SIZE);
        default:
          break;
    }

    const idx = a >> TAG_SIZE;
    assert(idx < this.stack.length, 'out of bounds gbox index');
    return this.stack[idx];
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

  private decodeComponent(idx: number): ComponentInstance {
    return new ComponentInstanceProxy(idx, this.wasmVM, this);
  }
}

const FIELD_DEFINITION = 0;
const FIELD_MANAGER = 1;
const FIELD_STATE = 2;
const FIELD_HANDLE = 3;
const FIELD_TABLE = 4;

class ComponentInstanceProxy implements ComponentInstance {
  constructor(private idx: number, private vm: WasmLowLevelVM, private cx: Context) {
    if (DEBUG) {
      Object.seal(this);
    }
  }

  private field(idx: number): any {
    const gbox = this.vm.component_field(this.idx, idx);
    return this.cx.decode(gbox);
  }

  private set_field(idx: number, val: any) {
    this.vm.set_component_field(this.idx, idx, this.cx.encode(val));
  }

  get definition(): ComponentDefinition {
    return this.field(FIELD_DEFINITION) as ComponentDefinition;
  }

  set definition(d: ComponentDefinition) {
    this.set_field(FIELD_DEFINITION, d);
  }

  get manager(): InternalComponentManager {
    return this.field(FIELD_MANAGER) as InternalComponentManager;
  }

  set manager(v: InternalComponentManager) {
    this.set_field(FIELD_MANAGER, v);
  }

  get state(): ComponentInstanceState {
    return this.field(FIELD_STATE) as ComponentInstanceState;
  }

  set state(v: ComponentInstanceState) {
    this.set_field(FIELD_STATE, v);
  }

  get handle(): number {
    return this.field(FIELD_HANDLE) as number;
  }

  set handle(v: number) {
    this.set_field(FIELD_HANDLE, v);
  }

  get table(): ProgramSymbolTable {
    return this.field(FIELD_TABLE) as ProgramSymbolTable;
  }

  set table(v: ProgramSymbolTable) {
    this.set_field(FIELD_TABLE, v);
  }
}
