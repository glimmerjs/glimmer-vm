import type { Application } from '@/components/Application';
import { RowComponent } from '@/components/RowComponent';
import type { Item } from '@/utils/data';

/*
  This is a list manager, it's used to render and sync a list of items.
  It's a proof of concept, it's not optimized, it's not a final API.

  Based on Glimmer-VM list update logic.
*/

export class ListComponent {
  parent: HTMLElement;
  app: Application;
  keyMap: Map<string, ReturnType<typeof RowComponent>> = new Map();
  nodes: Node[] = [];
  destructors: Array<() => void> = [];
  index = 0;
  constructor({ app, items }: { app: Application; items: Item[] }, outlet: HTMLElement) {
    const table = createTable();
    this.nodes = [table];
    this.app = app;
    this.parent = table.childNodes[0] as HTMLElement;
    this.syncList(items);
    outlet.appendChild(table);
  }
  keyForItem(item: Item) {
    return String(item.id);
  }
  syncList(items: Item[]) {
    const existingKeys = new Set(this.keyMap.keys());
    const updatingKeys = new Set(items.map((item) => this.keyForItem(item)));
    const keysToRemove = [...existingKeys].filter((key) => !updatingKeys.has(key));
    const amountOfKeys = existingKeys.size;
    let targetNode = amountOfKeys > 0 ? this.parent : document.createDocumentFragment();
    const rowsToMove: Array<[ReturnType<typeof RowComponent>, number]> = [];
    let seenKeys = 0;

    // iterate over existing keys and remove them
    const removedIndexes = keysToRemove.map((key) => this.destroyListItem(key));
    for (const value of this.keyMap.values()) {
      removedIndexes.forEach((index) => {
        if (value.index > index) {
          value.index--;
        }
      });
    }

    items.forEach((item, index) => {
      if (seenKeys === amountOfKeys && !(targetNode instanceof DocumentFragment)) {
        // optimization for appending items case
        targetNode = document.createDocumentFragment();
      }
      const key = this.keyForItem(item);
      const maybeRow = this.keyMap.get(key);
      if (!maybeRow) {
        const row = RowComponent({ item, app: this.app }, targetNode);
        row.index = index;
        this.keyMap.set(key, row);
      } else {
        seenKeys++;
        if (maybeRow.index !== index) {
          rowsToMove.push([maybeRow, index]);
        }
      }
    });
    // iterate over rows to move and move them
    rowsToMove.forEach(([row, index]) => {
      const nextItem = items[index + 1];
      if (nextItem === undefined) {
        row.index = index;
        row.nodes.forEach((node) => this.parent.appendChild(node));
      } else {
        const nextKey = this.keyForItem(nextItem);
        const nextRow = this.keyMap.get(nextKey);
        const firstNode = row.nodes[0];
        if (nextRow && firstNode) {
          nextRow.nodes.forEach((node) => this.parent.insertBefore(firstNode, node));
        }
        row.index = index;
      }
    });
    if (targetNode instanceof DocumentFragment) {
      this.parent.appendChild(targetNode);
    }
    return this;
  }
  destroyListItem(key: string) {
    const row = this.keyMap.get(key)!;
    row.destructors.forEach((fn) => fn());
    this.keyMap.delete(key);
    row.nodes.forEach((node) => {
      node.parentElement?.removeChild(node);
    });
    return row.index;
  }
}

function createTable() {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.className = 'table table-hover table-striped test-data';
  tbody.setAttribute('id', 'tbody');
  table.appendChild(tbody);
  return table;
}
