/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import type {
  Bounds,
  Environment,
  Maybe,
  ModifierInstance,
  Nullable,
  SimpleElement,
  SimpleNode,
  SimpleText,
  TreeBuilder,
} from '@glimmer/interfaces';
import type { RemoteBlock } from '@glimmer/runtime';
import { ConcreteBounds, NewTreeBuilder } from '@glimmer/runtime';

const TEXT_NODE = 3;

const NEEDS_EXTRA_CLOSE = new WeakMap<SimpleNode>();

function currentNode(
  cursor: TreeBuilder | { element: SimpleElement; nextSibling: SimpleNode }
): Nullable<SimpleNode> {
  let { element, nextSibling } = cursor;

  if (nextSibling === null) {
    return element.lastChild;
  } else {
    return nextSibling.previousSibling;
  }
}

class SerializeBuilder extends NewTreeBuilder implements TreeBuilder {
  private serializeBlockDepth = 0;

  override __openBlock(): void {
    let { tagName } = this.element;

    if (tagName !== 'TITLE' && tagName !== 'SCRIPT' && tagName !== 'STYLE') {
      let depth = this.serializeBlockDepth++;
      this.__appendComment(`%+b:${depth}%`);
    }

    super.__openBlock();
  }

  override __closeBlock(): void {
    let { tagName } = this.element;

    super.__closeBlock();

    if (tagName !== 'TITLE' && tagName !== 'SCRIPT' && tagName !== 'STYLE') {
      let depth = --this.serializeBlockDepth;
      this.__appendComment(`%-b:${depth}%`);
    }
  }

  override __appendHTML(html: string): Bounds {
    let { tagName } = this.element;

    if (tagName === 'TITLE' || tagName === 'SCRIPT' || tagName === 'STYLE') {
      return super.__appendHTML(html);
    }

    // Do we need to run the html tokenizer here?
    let first = this.__appendComment('%glmr%');
    if (tagName === 'TABLE') {
      let openIndex = html.indexOf('<');
      if (openIndex > -1) {
        let tr = html.slice(openIndex + 1, openIndex + 3);
        if (tr === 'tr') {
          html = `<tbody>${html}</tbody>`;
        }
      }
    }
    if (html === '') {
      this.__appendComment('% %');
    } else {
      super.__appendHTML(html);
    }

    let last = this.__appendComment('%glmr%');
    return new ConcreteBounds(this.element, first, last);
  }

  override __appendText(string: string): SimpleText {
    let { tagName } = this.element;
    let current = currentNode(this);

    if (tagName === 'TITLE' || tagName === 'SCRIPT' || tagName === 'STYLE') {
      return super.__appendText(string);
    } else if (string === '') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.__appendComment('% %') as any as SimpleText;
    } else if (current && current.nodeType === TEXT_NODE) {
      this.__appendComment('%|%');
    }

    return super.__appendText(string);
  }

  override closeElement(): Nullable<ModifierInstance[]> {
    if (NEEDS_EXTRA_CLOSE.has(this.element)) {
      NEEDS_EXTRA_CLOSE.delete(this.element);
      super.closeElement();
    }

    return super.closeElement();
  }

  override openElement(tag: string) {
    if (tag === 'tr') {
      if (
        this.element.tagName !== 'TBODY' &&
        this.element.tagName !== 'THEAD' &&
        this.element.tagName !== 'TFOOT'
      ) {
        this.openElement('tbody');
        // This prevents the closeBlock comment from being re-parented
        // under the auto inserted tbody. Rehydration builder needs to
        // account for the insertion since it is injected here and not
        // really in the template.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        NEEDS_EXTRA_CLOSE.set(this.constructing!, true);
        this.flushElement(null);
      }
    }

    return super.openElement(tag);
  }

  override pushRemoteElement(
    element: SimpleElement,
    cursorId: string,
    insertBefore: Maybe<SimpleNode> = null
  ): RemoteBlock {
    let { dom } = this;
    let script = dom.createElement('script');
    script.setAttribute('glmr', cursorId);
    dom.insertBefore(element, script, insertBefore);
    return super.pushRemoteElement(element, cursorId, insertBefore);
  }
}

export function serializeBuilder(
  env: Environment,
  cursor: { element: SimpleElement; nextSibling: Nullable<SimpleNode> }
): TreeBuilder {
  return SerializeBuilder.forInitialRender(env, cursor);
}
