import { addEventListener } from '@/utils/component';

export function ButtonComponent(
  { onClick, text, slot, id }: { onClick: () => void; text: string; slot?: Node; id?: string },
  outlet: HTMLElement
) {
  const button = document.createElement('button');
  button.setAttribute('class', 'btn btn-primary btn-block');
  button.type = 'button';

  const textNode = document.createTextNode(text);
  if (id) {
    button.setAttribute('id', id);
  }
  button.appendChild(textNode);
  if (slot) {
    button.appendChild(slot);
  }

  outlet.appendChild(button);

  return {
    nodes: [button],
    destructors: [addEventListener(button, 'click', onClick)],
    index: 0,
  };
}
