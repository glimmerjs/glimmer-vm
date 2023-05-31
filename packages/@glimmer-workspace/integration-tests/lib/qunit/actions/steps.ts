import { unwrap } from '@glimmer/validator/lib/utils';

export abstract class ActionData implements QUnit.Action, QUnit.ActionData {
  static from<This extends typeof Action | typeof Step>(
    this: This,
    data: QUnit.ActionData
  ): InstanceType<This>;
  static from(
    this: typeof ActionData,
    data: QUnit.ActionData,
    type: 'action' | 'step'
  ): Action | Step;
  static from<This extends typeof Action | typeof Step | typeof ActionData>(
    this: This,
    data: QUnit.ActionData,
    type?: 'action' | 'step'
  ): Action | Step {
    return this.create(data, type);
  }

  static toFragment<This extends typeof Action | typeof Step>(
    this: This,
    data: QUnit.ActionData
  ): DocumentFragment;
  static toFragment(
    this: typeof ActionData,
    data: QUnit.ActionData,
    type: 'action' | 'step'
  ): DocumentFragment;
  static toFragment<This extends typeof Action | typeof Step | typeof ActionData>(
    this: This,
    data: QUnit.ActionData,
    type?: 'action' | 'step'
  ): DocumentFragment {
    let typeFragment = data.type ? frag`<span class="type">${data.type}</span>` : undefined;
    type = this === ActionData ? unwrap(type) : (this as typeof Action | typeof Step).type;
    return frag`<span class="${type}">${typeFragment}<span class="description">${data.description}</span></span>`;
  }

  static parse<This extends typeof Action | typeof Step>(
    this: This,
    data: string
  ): InstanceType<This>;
  static parse(this: typeof ActionData, data: string, kind: 'action' | 'step'): Action | Step;
  static parse<This extends typeof Action | typeof Step | typeof ActionData>(
    this: This,
    data: string,
    kind?: 'action' | 'step'
  ): Action | Step {
    return this.create(parseData(data), kind);
  }

  private static create<This extends typeof Action | typeof Step | typeof ActionData>(
    this: This,
    { type, description }: QUnit.ActionData,
    kind?: 'action' | 'step'
  ): Action | Step {
    if (this === ActionData) {
      return kind === 'action' ? new Action(type, description) : new Step(type, description);
    } else {
      return new (this as typeof Action | typeof Step)(type, description);
    }
  }

  readonly type: string | undefined;
  readonly description: string;

  constructor(type: string | undefined, description: string) {
    this.type = type;
    this.description = description;
  }

  get desc() {
    return this.type ? `${this.type}: ${this.description}` : this.description;
  }

  matches(specification: string | ActionData) {
    if (typeof specification === 'string') {
      let [type, description] = specification.split(/:\s*/u);
      return this.type === type && this.description === description;
    } else {
      return this.type === specification.type && this.description === specification.description;
    }
  }
}

function parseData(data: string): { type: string | undefined; description: string } {
  let parsedSquare = /^\[([^\]]*)\](.*)$/u.exec(data);

  if (parsedSquare) {
    return {
      type: unwrap(parsedSquare[1]).trim(),
      description: unwrap(parsedSquare[2]).trim(),
    };
  }

  let colonIndex = data.indexOf(':');
  return colonIndex === -1
    ? { type: undefined, description: data }
    : {
        type: data.slice(0, colonIndex).trim(),
        description: data.slice(colonIndex + 1).trim(),
      };
}

export class Step extends ActionData {
  static readonly type = 'step';

  static matches(string: string) {
    return string.includes(`[[step|`);
  }

  static override from(this: void, { type, description }: QUnit.ActionData) {
    return new Step(type, description);
  }

  override toString(): string {
    return `[[step| ${this.desc}]]`;
  }
}

export class Action extends ActionData {
  static readonly type = 'action';

  static matches(this: void, string: string) {
    return string.includes(`{{action|`);
  }
  static empty(this: void): DocumentFragment {
    return frag`<span class="empty">Ø</span>`;
  }

  override toString() {
    return `{{action| ${this.desc}}}`;
  }
}

export class DiffEntry {
  readonly operation: 'missing' | 'unexpected' | 'match';
  readonly action: QUnit.Action;

  constructor(operation: 'missing' | 'unexpected' | 'match', action: QUnit.Action) {
    this.operation = operation;
    this.action = action;
  }

  toFragment(): DocumentFragment {
    let action = Action.toFragment(this.action);
    let fragment = frag`<span class="diff ${this.operation}">${action}</span>`;
    return fragment;
  }
}

export function frag(raw: TemplateStringsArray, ...dynamic: unknown[]): DocumentFragment {
  let template = document.createElement('template');

  let html = '';
  let placeholders: Record<number, ChildNode> = {};

  for (let [i, part] of raw.entries()) {
    html += part;
    if (i < dynamic.length) {
      let value = dynamic[i];

      if (value && value instanceof Node) {
        html += `<template id='template-${i}'></template>`;
        placeholders[i] = value as ChildNode;
      } else if (value !== undefined) {
        html += dynamic[i];
      }
    }
  }

  template.innerHTML = html;
  let fragment = template.content;

  for (let [i, child] of Object.entries(placeholders)) {
    let placeholder = fragment.querySelector(`#template-${i}`);
    placeholder?.parentElement?.insertBefore(child, placeholder);
    placeholder?.remove();
  }

  return template.content;
}
