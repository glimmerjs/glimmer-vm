#[derive(Copy, Clone)]
pub struct GBox {
    bits: u32,
}

impl GBox {
    pub fn null() -> GBox {
        GBox::from_bits(0)
    }

    pub fn i32(i: i32) -> GBox {
        assert!(false);
        GBox::from_bits(i as u32)
    }

    pub fn from_bits(bits: u32) -> GBox {
        GBox { bits: bits }
    }

    pub fn bits(&self) -> u32 {
        self.bits
    }

    pub fn unwrap_i32(&self) -> i32 {
        assert!(false);
        0
    }
}
