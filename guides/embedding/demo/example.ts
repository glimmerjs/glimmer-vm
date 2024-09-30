/* eslint-disable no-console */
// Component() expects a serialized/precompiled template
import { setOwner } from '@glimmer/owner';
import { createDocument } from 'simple-dom';

import renderRoot, { rerender } from './lib/core/index';
import { Cell } from './lib/utils/cell';
import { tracked } from './lib/utils/tracked';
import { compile, component, serialize } from './lib/utils/utils';

// Cell and tracked are very simple implementations of tracked values built on
// @glimmer/validator's tags. They're used here to demonstrate reactivity.
export const h = new Cell('hello');
const w = new Cell('world');
export const args = tracked({ kind: 'great' });

export const template = compile(
  `{{#let h w as |hello world|}}<p>{{hello.current}} {{this.kind}} {{world.current}}</p>{{/let}}`,
  { h, w },
  { module: 'testing' }
);

console.log({ template });

// This associates the template with the component class and sets up a simple component manager: it
// instantiates the class with the owner and named arguments, uses the instance as the template's
// `this`, and `destroy()`s the instance when the component is destroyed.
@component(template)
export class CustomComponent {
  // args is here to demonstrate the interaction between reactivity and `this` when a reactive
  // object is passed as arguments at the top level.
  #args: { kind: string };

  constructor(owner: object, args: { kind: string }) {
    setOwner(this, owner);
    this.#args = args;
  }

  get kind() {
    return this.#args.kind.toUpperCase();
  }
}

// This is a Node demo, so we create a SimpleDOM element.
const doc = createDocument();
export const element = doc.createElement('div');

// render the component
await renderRoot(CustomComponent, { element, interactive: false, args });
console.log(serialize(element));

// update the reactive interior of one of the locals
await rerender(() => (h.current = 'goodbye'));
console.log(serialize(element));

// update one of the arguments
await rerender(() => (args.kind = 'cruel'));
console.log(serialize(element));

// TODO: create a second component and invoke it
