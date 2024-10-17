import type { ComponentRenderTarget, Destructors } from '@/utils/component';
import { addEventListener, targetFor } from '@/utils/component';
import type { Cell, MergedCell } from '@/utils/reactive';
import { maybeUpdatingAttributeOpcode, maybeUpdatingPropertyOpcode } from '@/utils/vm';

export function TagComponent(
  {
    name,
    className,
    events,
    slot,
    attributes,
    text,
  }: {
    name: string;
    className?: string | Cell | MergedCell;
    attributes?: Record<string, string | Cell | MergedCell>;
    events?: Record<string, EventListener>;
    text?: string | Cell | MergedCell;
    slot?: Node;
  },
  outlet: ComponentRenderTarget
) {
  const element = document.createElement(name);
  const destructors: Destructors = [];
  if (events) {
    Object.keys(events).forEach((eventName) => {
      const fn = events[eventName];
      if (fn) {
        destructors.push(addEventListener(element, eventName, fn));
      }
    });
  }

  if (attributes) {
    Object.keys(attributes).forEach((attributeName) => {
      const value = attributes[attributeName];
      if (value) {
        maybeUpdatingAttributeOpcode(destructors, element, attributeName, value);
      }
    });
  }

  const slotNode = slot || document.createTextNode('');

  if (className !== undefined) {
    maybeUpdatingPropertyOpcode(destructors, element, 'className', className);
  }

  if (text !== undefined) {
    maybeUpdatingPropertyOpcode(destructors, slotNode, 'textContent', text);
  }

  element.appendChild(slotNode);

  targetFor(outlet).appendChild(element);

  return {
    nodes: [element],
    destructors,
    index: 0,
  };
}
