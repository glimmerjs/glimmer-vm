import { ifCondition } from '@/components/if';
import type { ComponentRenderTarget } from '@/utils/component';
import type { AnyCell, Cell } from '@/utils/reactive';
import { bindUpdatingOpcode } from '@/utils/vm';

export function LabelComponent({ text }: { text: string | AnyCell }, outlet: HTMLElement) {
  const span = document.createElement('span');
  const destructors = [];
  if (typeof text !== 'string') {
    destructors.push(
      bindUpdatingOpcode(text, (text) => {
        span.textContent = String(text);
      })
    );
  } else {
    span.textContent = text;
  }
  outlet.appendChild(span);
  return {
    nodes: [span],
    destructors,
    index: 0,
  };
}

export function LabelWrapperComponent(
  { isVisible }: { isVisible: Cell<boolean> },
  outlet: ComponentRenderTarget
) {
  const hoveredDiv = document.createElement('div');
  const div = document.createElement('div');

  LabelComponent({ text: '🗿' }, hoveredDiv);
  LabelComponent({ text: '😄' }, div);

  return {
    nodes: [div],
    destructors: [ifCondition(isVisible, outlet, hoveredDiv, div)],
    index: 0,
  };
}
