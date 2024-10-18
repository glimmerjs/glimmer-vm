import { targetFor, type ComponentRenderTarget } from '@/utils/component';
import type { Cell } from '@/utils/reactive';
import { bindUpdatingOpcode } from '@/utils/vm';

export function ifCondition(
  cell: Cell<boolean>,
  outlet: ComponentRenderTarget,
  trueBranch: HTMLElement | null,
  falseBranch: HTMLElement | null
) {
  const placeholder = document.createComment('placeholder');
  const target = targetFor(outlet);
  target.appendChild(placeholder);
  return bindUpdatingOpcode(cell, (value) => {
    if (value === true) {
      dropFirstApplySecond(target, placeholder, falseBranch, trueBranch);
    } else {
      dropFirstApplySecond(target, placeholder, trueBranch, falseBranch);
    }
  });
}

function dropFirstApplySecond(
  target: HTMLElement | DocumentFragment,
  placeholder: Comment,
  first: HTMLElement | null,
  second: HTMLElement | null
) {
  if (first && first.isConnected) {
    target.removeChild(first);
  }
  if (second && !second.isConnected) {
    target.insertBefore(second, placeholder);
  }
}
