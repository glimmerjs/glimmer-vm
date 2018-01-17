pub fn list_read<T>(head: &Option<Box<T>>, at: u32) -> Option<&T::Item>
    where T: LinkedListNode
{
    let mut cur = head;
    let mut at = at as usize;
    loop {
        let tmp = cur;
        let me = tmp.as_ref()?;
        if at < me.data().len() {
            return Some(&me.data()[at])
        }
        at -= me.data().len();
        cur = me.next();
    }
}

pub fn list_read_mut<T>(head: &mut Option<Box<T>>, at: u32) -> Option<&mut T::Item>
    where T: LinkedListNode
{
    let mut cur = head;
    let mut at = at as usize;
    loop {
        let tmp = cur;
        let me = tmp.as_mut()?;
        if at < me.data().len() {
            return Some(&mut me.data_mut()[at])
        }
        at -= me.data().len();
        cur = me.next_mut();
    }
}

pub fn list_write<T: LinkedListNode>(head: &mut Option<Box<T>>, at: u32, val: T::Item) {
    let mut cur = head;
    let mut at = at as usize;
    loop {
        let tmp = cur;
        let me = tmp.get_or_insert_with(T::new);
        if at < me.data().len() {
            me.data_mut()[at] = val;
            return
        }
        at -= me.data().len();
        cur = me.next_mut();
    }
}

pub trait LinkedListNode {
    type Item: Copy;

    fn new() -> Box<Self>;
    fn data(&self) -> &[Self::Item];
    fn data_mut(&mut self) -> &mut [Self::Item];
    fn next(&self) -> &Option<Box<Self>>;
    fn next_mut(&mut self) -> &mut Option<Box<Self>>;
}

macro_rules! linked_list_node {
    (
        struct $name:ident {
            data: [$t:ty = $e:expr; $amt:expr],
        }
    ) => (
        struct $name {
            data: [$t; $amt],
            next: Option<Box<$name>>,
        }

        impl ::util::LinkedListNode for $name {
            type Item = $t;

            fn new() -> Box<Self> {
                Box::new($name {
                    data: [$e; $amt],
                    next: None,
                })
            }

            fn data(&self) -> &[Self::Item] {
                &self.data
            }

            fn data_mut(&mut self) -> &mut [Self::Item] {
                &mut self.data
            }

            fn next(&self) -> &Option<Box<Self>> {
                &self.next
            }

            fn next_mut(&mut self) -> &mut Option<Box<Self>> {
                &mut self.next
            }
        }
    )
}
