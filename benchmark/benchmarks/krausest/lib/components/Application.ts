import type { Item } from '@/utils/data';
import { buildData, swapRows, updateData } from '@/utils/data';

import { ListComponent } from './list';
import { Cell, tagsToRevalidate } from '@/utils/reactive';
import type { ComponentReturnType } from '@/utils/component';
import { ButtonComponent } from '@/components/ButtonComponent';
import { bindUpdatingOpcode } from '@/utils/vm';
export class Application {
  _items = new Cell<Item[]>([], 'items');
  get items() {
    return this._items.value;
  }
  set items(value: Item[]) {
    this._items.update(value);
  }
  list: ListComponent;
  children: ComponentReturnType[] = [];
  selectedCell = new Cell(0, 'selectedCell');
  buttonWrapper() {
    const div = document.createElement('div');
    div.className = 'col-sm-6 smallpad';
    return div;
  }
  constructor() {
    /* benchmark bootstrap start */
    const container = document.createElement('container');
    container.className = 'container';
    const jumbotron = document.createElement('div');
    jumbotron.className = 'jumbotron';
    const row1 = document.createElement('div');
    row1.className = 'row';
    const leftColumn = document.createElement('div');
    leftColumn.className = 'col-md-6';
    const rightColumn = document.createElement('div');
    rightColumn.className = 'col-md-6';
    const h1 = document.createElement('h1');
    h1.textContent = 'GlimmerCore';
    const row2 = document.createElement('div');
    row2.className = 'row';

    const btnW1 = this.buttonWrapper();
    const btnW2 = this.buttonWrapper();
    const btnW3 = this.buttonWrapper();
    const btnW4 = this.buttonWrapper();
    const btnW5 = this.buttonWrapper();
    const btnW6 = this.buttonWrapper();

    /**/ container.appendChild(jumbotron);
    /*  */ jumbotron.appendChild(row1);
    /*    */ row1.appendChild(leftColumn);
    /*      */ leftColumn.appendChild(h1);
    /*    */ row1.appendChild(rightColumn);
    /*      */ rightColumn.appendChild(row2);
    /*        */ row2.appendChild(btnW1);
    /*        */ row2.appendChild(btnW2);
    /*        */ row2.appendChild(btnW3);
    /*        */ row2.appendChild(btnW4);
    /*        */ row2.appendChild(btnW5);
    /*        */ row2.appendChild(btnW6);
    /* benchmark bootstrap end */

    this.children.push(
      ButtonComponent(
        {
          onClick: () => this.create_1_000_Items(),
          text: 'Create 1000 items',
          id: 'run',
        },
        btnW1
      ),
      ButtonComponent(
        {
          onClick: () => this.create_5_000_Items(),
          text: 'Create 5 000 items',
          id: 'runlots',
        },
        btnW2
      ),
      ButtonComponent(
        {
          onClick: () => this.append_1_000_Items(),
          text: 'Append 1000 rows',
          id: 'add',
        },
        btnW3
      ),
      ButtonComponent(
        {
          onClick: () => this.updateEvery_10th_row(),
          text: 'Update every 10th row',
          id: 'update',
        },
        btnW4
      ),
      ButtonComponent(
        {
          onClick: () => this.clear(),
          text: 'Clear',
          id: 'clear',
        },
        btnW5
      ),
      ButtonComponent(
        {
          onClick: () => this.swapRows(),
          text: 'Swap rows',
          id: 'swaprows',
        },
        btnW6
      )
    );

    this.items = [];
    this.list = new ListComponent({ app: this, items: this.items }, container);

    /* benchmark icon preload span start */
    const preloadSpan = document.createElement('span');
    preloadSpan.className = 'preloadicon glyphicon glyphicon-remove';
    preloadSpan.setAttribute('aria-hidden', 'true');
    container.appendChild(preloadSpan);
    document.body.appendChild(container);
    /* benchmark icon preload span end */

    tagsToRevalidate;

    bindUpdatingOpcode(this._items, () => {
      this.list.syncList(this.items);
    });

    this.children.push(this.list);
  }
  removeItem(item: Item) {
    this.items = this.items.filter((i) => i.id !== item.id);
  }
  create_1_000_Items() {
    this.items = buildData(1000);
  }
  append_1_000_Items() {
    this.items = [...this.items, ...buildData(1000)];
  }
  create_5_000_Items() {
    this.items = buildData(5000);
  }
  swapRows() {
    this.items = swapRows(this.items);
  }
  clear() {
    this.items = [];
  }
  updateEvery_10th_row() {
    updateData(this.items, 10);
  }
}
