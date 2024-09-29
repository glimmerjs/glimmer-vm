// Component() expects a serialized/precompiled template
import { consumeTag, createTag, dirtyTag } from '@glimmer/validator';
import { createDocument } from 'simple-dom';

import renderComponent, { didRender } from './lib/core/index';
import { compile, define, serialize } from './lib/utils';

class Cell<T> {
  #tag = createTag();
  #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  get current() {
    consumeTag(this.#tag);
    return this.#value;
  }

  set current(value: T) {
    this.#value = value;
    dirtyTag(this.#tag);
  }
}

const h = new Cell('hello');
const w = new Cell('world');

export const template = compile(
  `{{#let h w as |hello world|}}<p>{{hello.current}} {{world.current}}</p>{{/let}}`,
  { h, w },
  { module: 'testing' }
);

export class CustomComponent {
  constructor(_owner: object) {}
}

define({ template, ComponentClass: CustomComponent });

const doc = createDocument();
export const element = doc.createElement('div');

await renderComponent(CustomComponent, { element });

console.log(serialize(element));

h.current = 'goodbye';

await didRender();

console.log(serialize(element));
