use std::rc::Rc;

use wasm_bindgen::prelude::*;

use component::Component;
use ffi;
use gbox::{GBox, GBOX_NULL, Value};
use heap::{WasmHeap, Heap};
use instructions::Encoder;
use my_ref_cell::MyRefCell;
use opcode::{Opcode, Op};
use stack::Stack;
use to_u32;
use track::Tracked;
use util;

pub struct VM {
    context: JsValue,
    stack: Stack,
    instructions: Encoder,

    // Right now these are encoded as `i32` because the "exit" address is
    // encoded as -1, but these may wish to change in the future to a `u32`
    // representation.
    pc: i32,
    ra: i32,
    current_op_size: i32,

    boxed_registers: [GBox; 5],

    // Right now for many component-related opcodes we need to manage instances
    // of `ComponentInstance`. This implementation currently moves management of
    // that structure into Rust, and this `components` field is basically a
    // vector of `Component` structs.
    //
    // Indices into this list are stored into a `GBox` (tagged appropriately)
    // and are then accessed indirectly in JS when they're decoded (any writes
    // and reads in JS end up coming back to this list).
    //
    // The `components_len` field just tracks basically the next position to
    // write at. This is a pretty jank vector (it's a linked list)
    components: Option<Box<Components>>,
    components_len: u32,

    _tracked: Tracked,
}

linked_list_node! {
    struct Components {
        data: [Component = Component {
            definition: GBOX_NULL,
            manager: GBOX_NULL,
            state: GBOX_NULL,
            handle: GBOX_NULL,
            table: GBOX_NULL,
        }; 128],
    }
}

// these should all stay in sync with `registers.ts`
pub const PC: u16 = 0;
pub const RA: u16 = 1;
pub const FP: u16 = 2;
pub const SP: u16 = 3;
pub const S0: u16 = 4;
pub const S1: u16 = 5;
pub const T0: u16 = 6;
pub const T1: u16 = 7;
pub const V0: u16 = 8;

impl VM {
    fn new(cx: JsValue) -> VM {
        let stack = Stack::new(0, -1);
        VM {
            context: cx,
            pc: -1,
            ra: -1,
            current_op_size: 0,
            stack: stack,
            boxed_registers: [GBox::null(); 5],
            components: None,
            components_len: 0,
            instructions: Encoder::new(),
            _tracked: Tracked::new(),
        }
    }

    fn register(&self, i: u16) -> GBox {
        match i {
            PC => GBox::i32(self.pc),
            RA => GBox::i32(self.ra),
            FP => GBox::i32(self.stack.fp()),
            SP => GBox::i32(self.stack.sp()),
            _ => {
                let reg = self.boxed_registers.get((i - S0) as usize);
                debug_assert!(reg.is_some());
                reg.cloned().unwrap_or(GBox::null())
            }
        }
    }

    fn set_register(&mut self, i: u16, val: GBox) {
        match i {
            PC => self.pc = val.unwrap_i32(),
            RA => self.ra = val.unwrap_i32(),
            FP => self.stack.set_fp(val.unwrap_i32()),
            SP => self.stack.set_sp(val.unwrap_i32()),
            _ => {
                match self.boxed_registers.get_mut((i - S0) as usize) {
                    Some(slot) => *slot = val,
                    None => panic!("invalid register index: {}", i),
                }
            }
        }
    }

    // Start a new frame and save $ra and $fp on the stack
    fn push_frame(&mut self) {
        self.stack.push(GBox::i32(self.ra));
        let fp = self.stack.fp();
        self.stack.push(GBox::i32(fp));
        let sp = self.stack.sp();
        self.stack.set_fp(sp - 1);
    }

    // Restore $ra, $sp and $fp
    fn pop_frame(&mut self) {
        let fp = self.stack.fp();
        self.stack.set_sp(fp - 1);
        self.ra = self.stack.get(0).unwrap_i32();
        let fp = self.stack.get(1).unwrap_i32();
        self.stack.set_fp(fp);
    }

    // Jump to an address in the program
    fn goto(&mut self, offset: i32) {
        self.pc = self.pc + offset - self.current_op_size;
    }

    // Save $pc into $ra, then jump to a new address in `program` (jal in MIPS)
    fn call(&mut self, handle: u32, heap: &mut Heap) {
        self.ra = self.pc;
        self.pc = heap.get_addr(handle);
    }

    // Put a specific `program` address in $ra
    fn return_to(&mut self, offset: i32) {
        self.ra = self.pc + offset - self.current_op_size;
    }

    // Return to the `program` address stored in $ra
    fn return_(&mut self) {
        self.pc = self.ra;
    }

    fn next_statement(&mut self, heap: &mut Heap) -> Option<Opcode> {
        if self.pc == -1 {
            return None
        }

        // We have to save off the current operations size so that
        // when we do a jump we can calculate the correct offset
        // to where we are going. We can't simply ask for the size
        // in a jump because we have have already incremented the
        // program counter to the next instruction prior to executing.
        let opcode = Opcode::new(to_u32(self.pc));
        self.current_op_size = opcode.size(heap).into();
        self.pc = self.pc + self.current_op_size;
        Some(opcode)
    }

    fn evaluate(&mut self, opcode: Opcode, heap: &mut Heap) -> bool {
        match opcode.op(heap) {
            Op::PushFrame => self.push_frame(),
            Op::PopFrame => self.pop_frame(),
            Op::InvokeStatic => self.call(opcode.op1(heap).into(), heap),
            Op::InvokeVirtual => {
                let addr = self.stack.pop(1).unwrap_i32();
                self.call(to_u32(addr), heap)
            }
            Op::Jump => self.goto(opcode.op1(heap).into()),
            Op::Return => self.return_(),
            Op::ReturnTo => self.return_to(opcode.op1(heap).into()),

            Op::Pop => {
                self.stack.pop(opcode.op1(heap).into());
            }

            Op::Dup => {
                let position = self.register(opcode.op1(heap)).unwrap_i32();
                let offset: i32 = opcode.op2(heap).into();
                self.stack.dup(position - offset);
            }

            Op::Load => {
                let value = self.stack.pop(1);
                self.set_register(opcode.op1(heap), value);
            }

            Op::Fetch => {
                let value = self.register(opcode.op1(heap));
                self.stack.push(value);
            }

            // Op::PushDynamicComponentInstance => {
            //     let definition = self.stack.pop(1);
            //     let idx = self.add_component(Component {
            //         definition,
            //         manager: GBox::null(),
            //         state: GBox::null(),
            //         handle: GBox::null(),
            //         table: GBox::null(),
            //     });
            //     self.stack.push(GBox::component(idx));
            // }

            Op::PopulateLayout => {
                let handle = self.stack.pop(1); // CheckHandle
                let table = self.stack.pop(1); // CheckProgramSymbolTable

                let component = self.register(opcode.op1(heap));
                let component = self.unwrap_component(component);
                let component = self.component_mut(component);
                debug_assert!(component.is_some());
                if let Some(c) = component {
                    c.handle = handle;
                    c.table = table;
                }
            }

            Op::Primitive => {
                let primitive = opcode.op1(heap);

                // keep in sync with program/lib/constants.ts
                const NUMBER: u16 = 0b000;
                const FLOAT: u16 = 0b001;
                const STRING: u16 = 0b010;
                const BOOLEAN_OR_VOID: u16 = 0b011;
                const NEGATIVE: u16 = 0b100;
                const BIG_NUM: u16 = 0b101;

                let flag = primitive & 0b111;
                let value = primitive >> 3;
                let gbox = match flag {
                    NUMBER => GBox::i32(value.into()),
                    FLOAT => GBox::constant_number(value.into()),
                    STRING => GBox::constant_string(value.into()),
                    NEGATIVE => GBox::constant_number(value.into()),
                    BIG_NUM => GBox::constant_number(value.into()),

                    // TODO: should probably decouple the encoding of immediates
                    // for this opcode and the encoding of `GBox.
                    BOOLEAN_OR_VOID => GBox::from_bits(primitive.into()),

                    flag => panic!("unknown primitive flag: {:#b}", flag),
                };
                self.stack.push(gbox);
            }

            Op::Text => {
                let text = opcode.op1(heap);
                let val = GBox::constant_string(text.into());
                self.instructions.append_text(val);
            }

            Op::Comment => {
                let text = opcode.op1(heap);
                let val = GBox::constant_string(text.into());
                self.instructions.append_comment(val);
            }

            Op::OpenElement => {
                let tag = opcode.op1(heap);
                let val = GBox::constant_string(tag.into());
                self.instructions.open_element(val);
            }

            Op::OpenDynamicElement => {
                let tag = self.stack.pop(1);
                self.instructions.open_dynamic_element(tag);
            }

            Op::FlushElement => {
                let operations = self.register(T0);

                if operations.value() != Value::Null {
                    self.instructions.flush_element_operations(operations);
                    self.set_register(T0, GBox::null())
                }

                self.instructions.flush_element();
            }

            Op::CloseElement => {
                self.instructions.close_element();
            }

            Op::PushRemoteElement => {
                let element = self.stack.pop(1); // CheckReference
                let next_sibling = self.stack.pop(1); // CheckReference
                let guid = self.stack.pop(1); // CheckReference

                if !element.is_const() {
                    self.instructions.update_with_reference(element)
                }

                if !next_sibling.is_const() {
                    self.instructions.update_with_reference(next_sibling)
                }

                self.instructions.push_remote_element(element, guid, next_sibling);
            }

            Op::PopRemoteElement => {
                self.instructions.pop_remote_element();
            }

            Op::StaticAttr => {
                let name = GBox::constant_string(opcode.op1(heap).into());
                let value = GBox::constant_string(opcode.op2(heap).into());
                let namespace = match opcode.op3(heap) {
                    0 => GBox::null(),
                    n => GBox::constant_string(n.into()),
                };
                self.instructions.static_attr(name, value, namespace);
            }

            Op::DynamicAttr => {
                let name = GBox::constant_string(opcode.op1(heap).into());
                let reference = self.stack.pop(1); // CheckReference
                let trusting = opcode.op2(heap);
                let namespace = match opcode.op3(heap) {
                    0 => GBox::null(),
                    n => GBox::constant_string(n.into()),
                };
                let trusting = GBox::bool(trusting != 0);

                if reference.is_const() {
                    self.instructions.dynamic_attr_with_const(name,
                                                              reference,
                                                              trusting,
                                                              namespace);
                } else {
                    self.instructions.dynamic_attr(name,
                                                   reference,
                                                   trusting,
                                                   namespace);
                }
            }

            op => {
                debug_assert!(!opcode.is_machine(heap),
                              "bad opcode {:?}", op);
                return false
            }
        }

        true
    }

    fn add_component(&mut self, component: Component) -> u32 {
        let ret = self.components_len;
        util::list_write(&mut self.components, ret, component);
        self.components_len += 1;
        return ret
    }

    fn component(&self, component: u32) -> Option<&Component> {
        util::list_read(&self.components, component)
    }

    fn component_mut(&mut self, component: u32) -> Option<&mut Component> {
        util::list_read_mut(&mut self.components, component)
    }

    /// Unwrap the component index from a `gbox`, panicking if the `GBox` isn't
    /// actually a component.
    fn unwrap_component(&mut self, gbox: GBox) -> u32 {
        let idx = match gbox.value() {
            Value::Component(idx) => return idx, // yay that was easy!
            Value::Other(idx) => idx,            // see below
            _ => panic!("not a component or object"),
        };

        // Ok at this point we've found that our `GBox` actually represents a
        // JS object which we otherwise don't have access to. Currently, though,
        // not all component creation happens in Rust/Wasm so this arbitrary
        // object probably actually is a component!
        //
        // At this point we need the index in Rust so what we'll do is transfer
        // the source of truth about this component's state from JS to Rust. To
        // do this we ask JS what the component fields are (all the `GBox`
        // instances). Once we've got all those values we call `add_component`
        // to allocate the component inside our `VM`.
        //
        // Note that JS is also taking care to make sure that it understands
        // that the source of truth for this object now lives here, in Rust, as
        // opposed to JS.
        let mut fields = [1u32; 5];
        ffi::low_level_vm_load_component(
            &self.context,
            idx,
            fields.as_mut_ptr(),
            self.components_len,
        );
        self.add_component(Component {
            definition: GBox::from_bits(fields[FIELD_DEFINITION]),
            manager: GBox::from_bits(fields[FIELD_MANAGER]),
            state: GBox::from_bits(fields[FIELD_STATE]),
            handle: GBox::from_bits(fields[FIELD_HANDLE]),
            table: GBox::from_bits(fields[FIELD_TABLE]),
        })
    }
}

// Keep in sync with `gbox.ts`
//
// TODO: auto-generate this list
const FIELD_DEFINITION: usize = 0;
const FIELD_MANAGER: usize = 1;
const FIELD_STATE: usize = 2;
const FIELD_HANDLE: usize = 3;
const FIELD_TABLE: usize = 4;

#[wasm_bindgen]
pub struct LowLevelVM {
    inner: MyRefCell<VM>,
    heap: Rc<MyRefCell<Heap>>,
    last_error: MyRefCell<Option<JsValue>>,
    devmode: bool,
    syscalls: JsValue,
    externs: JsValue,
}

#[wasm_bindgen]
impl LowLevelVM {
    pub fn new(heap: &WasmHeap,
               syscalls: JsValue,
               externs: JsValue,
               context: JsValue,
               devmode: bool) -> LowLevelVM {
        LowLevelVM {
            inner: MyRefCell::new(VM::new(context)),
            last_error: MyRefCell::new(None),
            devmode,
            syscalls,
            externs,
            heap: heap.0.clone(),
        }
    }

    pub fn current_op_size(&self) -> u32 {
        to_u32(self.inner.borrow().current_op_size)
    }

    pub fn pc(&self) -> i32 {
        self.inner.borrow().pc
    }

    pub fn set_pc(&self, pc: i32) {
        self.inner.borrow_mut().pc = pc;
    }

    pub fn fp(&self) -> i32 {
        self.inner.borrow().stack.fp()
    }

    pub fn set_fp(&self, fp: i32) {
        self.inner.borrow_mut().stack.set_fp(fp)
    }

    pub fn sp(&self) -> i32 {
        self.inner.borrow().stack.sp()
    }

    pub fn set_sp(&self, sp: i32) {
        self.inner.borrow_mut().stack.set_sp(sp)
    }

    pub fn register(&self, i: u16) -> u32 {
        self.inner.borrow().register(i).bits()
    }

    pub fn set_register(&self, i: u16, val: u32) {
        self.inner.borrow_mut().set_register(i, GBox::from_bits(val));
    }

    pub fn push_frame(&self) {
        self.inner.borrow_mut().push_frame()
    }

    pub fn goto(&self, offset: i32) {
        self.inner.borrow_mut().goto(offset)
    }

    pub fn call(&self, handle: u32) {
        self.inner.borrow_mut().call(handle, &mut *self.heap.borrow_mut())
    }

    pub fn evaluate_all(&self, vm: &JsValue) -> u32 {
        loop {
            let r = self.evaluate_one(vm);
            if r != 0 {
                return r
            }
        }
    }

    pub fn evaluate_one(&self, vm: &JsValue) -> u32 {
        let next = {
            let mut heap = self.heap.borrow_mut();
            self.inner.borrow_mut().next_statement(&mut *heap)
        };
        let opcode = match next {
            Some(opcode) => opcode,
            None => return 1,
        };

        let state = if self.devmode {
            Some(ffi::low_level_vm_debug_before(&self.externs, opcode.offset()))
        } else {
            None
        };

        let complete = self.inner.borrow_mut().evaluate(
            opcode,
            &mut *self.heap.borrow_mut(),
        );
        if !complete {
            let res = ffi::low_level_vm_evaluate_syscall(&self.syscalls,
                                                         vm,
                                                         opcode.offset());
            if let Err(e) = res {
                *self.last_error.borrow_mut() = Some(e);
                return 2
            }
        }

        if let Some(state) = state {
            ffi::low_level_vm_debug_after(&self.externs,
                                          state,
                                          opcode.offset());
        }
        return 0
    }

    pub fn last_exception(&self) -> JsValue {
        self.last_error
            .borrow_mut()
            .take()
            .unwrap_or(self.syscalls.clone())
    }

    pub fn stack_copy(&self, from: u32, to: u32) -> bool {
        self.inner.borrow_mut().stack.copy(from, to).is_ok()
    }

    pub fn stack_write_raw(&self, at: u32, val: u32) {
        self.inner.borrow_mut().stack.write(at, GBox::from_bits(val));
    }

    pub fn stack_write(&self, at: u32, val: i32) {
        self.inner.borrow_mut().stack.write(at, GBox::i32(val));
    }

    pub fn stack_read_raw(&self, at: u32) -> u32 {
        self.inner.borrow().stack.read(at)
            .map(|g| g.bits())
            .unwrap_or(0)
    }

    pub fn stack_read(&self, at: u32) -> i32 {
        self.inner.borrow().stack.read(at)
            .map(|g| g.unwrap_i32())
            .unwrap_or(0)
    }

    pub fn stack_reset(&self) {
        self.inner.borrow_mut().stack.reset();
    }

    pub fn component_field(&self, component: u32, field: usize) -> u32 {
        let me = self.inner.borrow();
        let component = match me.component(component) {
            Some(c) => c,
            None => panic!("invalid component index"),
        };

        match field {
            FIELD_DEFINITION => component.definition.bits(),
            FIELD_MANAGER => component.manager.bits(),
            FIELD_STATE => component.state.bits(),
            FIELD_HANDLE => component.handle.bits(),
            FIELD_TABLE => component.table.bits(),
            _ => panic!("invalid component field"),
        }
    }

    pub fn set_component_field(&self, component: u32, field: usize, gbox: u32) {
        let val = GBox::from_bits(gbox);
        let mut me = self.inner.borrow_mut();
        let component = match me.component_mut(component) {
            Some(c) => c,
            None => panic!("invalid component index"),
        };

        match field {
            FIELD_DEFINITION => component.definition = val,
            FIELD_MANAGER => component.manager = val,
            FIELD_STATE => component.state = val,
            FIELD_HANDLE => component.handle = val,
            FIELD_TABLE => component.table = val,
            _ => panic!("invalid comopnent field"),
        }
    }

    pub fn instruction_encode(&self, component: u32, op1: u32, op2: u32) {
        self.inner.borrow_mut()
            .instructions
            .encode(component, GBox::from_bits(op1), GBox::from_bits(op2))
    }

    pub fn instruction_ptr(&self) -> *const u32 {
        self.inner.borrow_mut()
            .instructions
            .as_ptr()
    }

    pub fn instruction_finalize(&self) -> usize {
        self.inner.borrow_mut()
            .instructions
            .finalize()
    }
}
