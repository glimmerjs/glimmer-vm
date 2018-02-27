// Note that all of these constants need to be kept in sync with `gbox.ts`.
//
// TODO: use a build script to do that automaticcally

const TAG_NUMBER: u32          = 0b000;
const TAG_BOOLEAN_OR_VOID: u32 = 0b011;
const TAG_NEGATIVE: u32        = 0b100;
const TAG_ANY: u32             = 0b101;
const TAG_COMPONENT: u32       = 0b110;
const TAG_CONSTANT: u32        = 0b111;

const TAG_SIZE: usize = 3;
const TAG_MASK: u32 = (1 << TAG_SIZE) - 1;

const OBJECT_TAG_CONST_REFERENCE: u32 = 0b1000;
const OBJECT_TAG_SIZE: usize = 1;

const CONSTANT_TAG_SIZE: usize = 2;
const CONSTANT_TAG_MASK: u32 = (1 << CONSTANT_TAG_SIZE) - 1;

const CONSTANT_STRING: u32   = 0b00;
const CONSTANT_NUMBER: u32   = 0b01;

const IMM_FALSE: u32 = (0 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_TRUE: u32 = (1 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_NULL: u32 = (2 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_UNDEF: u32 = (3 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;

pub const GBOX_NULL: GBox = GBox { bits: IMM_NULL };

#[derive(Copy, Clone)]
pub struct GBox {
    bits: u32,
}

#[derive(PartialEq)]
pub enum Value {
    Integer(i32),
    Null,
    Undef,
    Bool(bool),
    Component(u32),
    Other(u32),
    ConstantString(u32),
    ConstantNumber(u32),
}

fn assert_constant_idx_ok(idx: u32) {
    let shift = TAG_SIZE + CONSTANT_TAG_SIZE;
    debug_assert_eq!((idx << shift) >> shift, idx);
}

impl GBox {
    pub fn null() -> GBox {
        GBox::from_bits(IMM_NULL)
    }

    pub fn undefined() -> GBox {
        GBox::from_bits(IMM_UNDEF)
    }

    pub fn i32(i: i32) -> GBox {
        let (val, tag) = if i < 0 {
            ((-i) as u32, TAG_NEGATIVE)
        } else {
            (i as u32, TAG_NUMBER)
        };
        debug_assert!(val & (TAG_MASK << (32 - TAG_SIZE)) == 0);
        GBox::from_bits((val << TAG_SIZE) | tag)
    }

    pub fn bool(b: bool) -> GBox {
        if b {
            GBox { bits: IMM_TRUE }
        } else {
            GBox { bits: IMM_FALSE }
        }
    }

    pub fn component(idx: u32) -> GBox {
        debug_assert!(idx & (TAG_MASK << (32 - TAG_SIZE)) == 0);
        GBox::from_bits((idx << TAG_SIZE) | TAG_COMPONENT)
    }

    pub fn from_bits(bits: u32) -> GBox {
        GBox { bits: bits }
    }

    pub fn constant_string(idx: u32) -> GBox {
        assert_constant_idx_ok(idx);
        GBox::constant(idx, CONSTANT_STRING)
    }

    pub fn constant_number(idx: u32) -> GBox {
        assert_constant_idx_ok(idx);
        GBox::constant(idx, CONSTANT_NUMBER)
    }

    fn constant(idx: u32, tag: u32) -> GBox {
        let bits = (idx << CONSTANT_TAG_SIZE) | tag;
        GBox::from_bits((bits << TAG_SIZE) | TAG_CONSTANT)
    }

    pub fn bits(&self) -> u32 {
        self.bits
    }

    pub fn unwrap_i32(&self) -> i32 {
        match self.value() {
            Value::Integer(i) => i,
            _ => panic!("not an integer"),
        }
    }

    pub fn value(&self) -> Value {
        match self.bits & TAG_MASK {
            TAG_NUMBER => Value::Integer((self.bits >> TAG_SIZE) as i32),
            TAG_NEGATIVE => Value::Integer(-((self.bits >> TAG_SIZE) as i32)),
            TAG_BOOLEAN_OR_VOID => {
                match self.bits {
                    IMM_FALSE => Value::Bool(false),
                    IMM_TRUE => Value::Bool(true),
                    IMM_UNDEF => Value::Undef,
                    IMM_NULL => Value::Null,
                    bits => panic!("invalid boolean or void tag: 0x{:x}", bits),
                }
            }
            TAG_ANY => Value::Other(self.bits >> TAG_SIZE >> OBJECT_TAG_SIZE),
            TAG_COMPONENT => Value::Component(self.bits >> TAG_SIZE),
            TAG_CONSTANT => {
                let bits = self.bits >> TAG_SIZE;
                let idx = bits >> CONSTANT_TAG_SIZE;
                match bits & CONSTANT_TAG_MASK {
                    CONSTANT_STRING => Value::ConstantString(idx),
                    CONSTANT_NUMBER => Value::ConstantNumber(idx),
                    tag => panic!("invalid constant tag: 0b{:b}", tag),
                }
            }
            tag => panic!("invalid tag: 0b{:b}", tag),
        }
    }

    pub fn is_const(&self) -> bool {
        (self.bits & OBJECT_TAG_CONST_REFERENCE) != 0
    }
}
