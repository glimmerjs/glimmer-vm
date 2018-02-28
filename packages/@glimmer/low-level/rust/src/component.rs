use gbox::GBox;

#[derive(Clone, Copy)]
pub struct Component {
    pub definition: GBox,
    pub manager: GBox,
    pub state: GBox,
    pub handle: GBox,
    pub table: GBox,
    pub capabilities: u32,
    pub lookup: GBox,
}
