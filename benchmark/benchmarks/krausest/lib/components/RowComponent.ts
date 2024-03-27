import type { Application } from '@/components/Application';
// import { ButtonComponent } from "@/components/ButtonComponent";
// import { LabelWrapperComponent } from "@/components/LabelComponent";
import { TagComponent } from '@/components/TagComponent';
import { targetFor, type ComponentRenderTarget, type Destructors } from '@/utils/component';
import type { Item } from '@/utils/data';
import { cellFor, formula } from '@/utils/reactive';
// import { maybeUpdatingPropertyOpcode } from "@/utils/vm";

export function RowComponent(
  { item, app }: { item: Item; app: Application },
  outlet: ComponentRenderTarget
) {
  // create cells for the item
  const id = item.id;
  const selectedCell = app.selectedCell;
  const cell2 = cellFor(item, 'label');
  // const isVisible = new Cell(false, 'isVisible');

  // classic event listener
  const onRowClick = () => {
    if (selectedCell.value === id) {
      return selectedCell.update(0);
    } else {
      selectedCell.update(id);
    }
  };
  // const onMouseEnter = () => {
  //   isVisible.update(true);
  // };
  // const onMouseLeave = () => {
  //   isVisible.update(false);
  // };

  // Create the row and cells
  const rootComponent = TagComponent(
    {
      name: 'tr',
      className: formula(() => {
        return id === selectedCell.value ? 'danger' : '';
      }, 'className'),
      // events: {
      //   mouseenter: onMouseEnter,
      //   mouseleave: onMouseLeave,
      // },
    },
    outlet
  );

  const rootNode = rootComponent.nodes[0] as HTMLElement;

  const idCell = TagComponent(
    {
      name: 'td',
      className: 'col-md-1',
      text: String(id),
    },
    rootNode
  );

  const labelCell = TagComponent(
    {
      name: 'td',
      className: 'col-md-4',
    },
    rootNode
  );

  const selectLink = TagComponent(
    {
      name: 'a',
      attributes: {
        'data-test-select': 'true',
      },
      events: {
        click: onRowClick,
      },
      text: cell2,
    },
    labelCell.nodes[0] as HTMLElement
  );

  const removeCell = TagComponent(
    {
      name: 'td',
      className: 'col-md-1',
    },
    rootNode
  );

  const emptyCell = TagComponent(
    {
      name: 'td',
      className: 'col-md-6',
    },
    rootNode
  );

  // const labelCmp = LabelWrapperComponent({ isVisible }, emptyCell.nodes[0] as HTMLElement);

  const destructors: Destructors = [
    ...rootComponent.destructors,
    ...selectLink.destructors,
    // ...labelCmp.destructors,
    ...idCell.destructors,
    ...labelCell.destructors,
    ...removeCell.destructors,
    ...emptyCell.destructors,
  ];

  const rmBtn = TagComponent(
    {
      name: 'a',
      attributes: { 'data-test-remove': 'true' },
      events: { click: () => app.removeItem(item) },
    },
    removeCell.nodes[0] as HTMLElement
  );

  const rmSpan = document.createElement('span');
  rmSpan.className = 'preloadicon glyphicon glyphicon-remove';
  rmSpan.setAttribute('aria-hidden', 'true');
  (rmBtn.nodes[0] as HTMLElement).appendChild(rmSpan);

  rmBtn.destructors.forEach((destructor) => {
    destructors.push(destructor);
  });

  const nodes = [...rootComponent.nodes];

  nodes.forEach((node) => {
    targetFor(outlet).appendChild(node);
  });

  return {
    nodes, // Bounds of the row /
    destructors, // Destructors for opcodes and event listeners
    index: 0, // Index of the row in the list
  };
}
