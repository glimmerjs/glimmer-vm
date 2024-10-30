import { MergedCell, Cell, opsForTag, type AnyCell, type tagOp } from './reactive';

export function maybeUpdatingAttributeOpcode<T extends HTMLElement>(
  destructors: Array<() => void>,
  node: T,
  name: string,
  value: undefined | null | string | Cell | MergedCell
) {
  if (value instanceof Cell || value instanceof MergedCell) {
    destructors.push(
      bindUpdatingOpcode(value, (value) => {
        node.setAttribute(name, String(value ?? ''));
      })
    );
  } else {
    node.setAttribute(name, String(value ?? ''));
  }
}

export function maybeUpdatingPropertyOpcode<T extends Node>(
  destructors: Array<() => void>,
  node: T,
  property: keyof T,
  value: undefined | null | string | Cell | MergedCell
) {
  if (value instanceof Cell || value instanceof MergedCell) {
    destructors.push(
      bindUpdatingOpcode(value, (value) => {
        (node as any)[property] = value;
      })
    );
  } else {
    (node as any)[property] = value || '';
  }
}

// this function creates opcode for a tag, it's called when we need to update DOM for a specific tag
export function bindUpdatingOpcode(tag: AnyCell, op: tagOp) {
  const ops = opsForTag.get(tag) || [];
  // apply the op to the current value
  op(tag.value);
  ops.push(op);
  opsForTag.set(tag, ops);
  return () => {
    // console.info(`Removing Updating Opcode for ${tag._debugName}`);
    const index = ops.indexOf(op);
    if (index > -1) {
      ops.splice(index, 1);
    }
  };
}
