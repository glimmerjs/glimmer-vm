// Note that all of these constants need to be kept in sync with `gbox.ts`.
//
// TODO: use a build script to do that automaticcally

const TAG_NUMBER: u32 = 0b000;
const TAG_BOOLEAN_OR_VOID: u32 = 0b011;
const TAG_NEGATIVE: u32 = 0b100;
const TAG_ANY: u32 = 0b101;

const TAG_SIZE: usize = 3;
const TAG_MASK: u32 = (1 << TAG_SIZE) - 1;

const IMM_FALSE: u32 = (0 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_TRUE: u32 = (1 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_NULL: u32 = (2 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;
const IMM_UNDEF: u32 = (3 << TAG_SIZE) | TAG_BOOLEAN_OR_VOID;

#[derive(Copy, Clone)]
pub struct GBox {
    bits: u32,
}

pub enum Value {
    Integer(i32),
    Null,
    Undef,
    Bool(bool),
    Other(GBox),
}

impl GBox {
    pub fn null() -> GBox {
        GBox::from_bits(IMM_NULL)
    }

    pub fn i32(i: i32) -> GBox {
        GBox::from_bits(encode_smi(i))
    }

    pub fn from_bits(bits: u32) -> GBox {
        GBox { bits: bits }
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
            TAG_ANY => Value::Other(*self),
            tag => panic!("invalid tag: 0b{:b}", tag),
        }
    }
}

pub fn encode_smi(val: i32) -> u32 {
    let (val, flags) = if val < 0 {
        ((-val) as u32, TAG_NEGATIVE)
    } else {
        (val as u32, TAG_NUMBER)
    };
    debug_assert!(val & (TAG_MASK << (32 - TAG_SIZE)) == 0);
    (val << 3) | flags
}
