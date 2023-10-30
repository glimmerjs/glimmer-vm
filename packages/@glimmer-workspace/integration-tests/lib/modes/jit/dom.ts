import type {
  ElementNamespace,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleText,
} from '@glimmer/interfaces';
import type { DomDelegate } from '../../render-delegate';
import { castToSimple } from '@glimmer/util';
import type RenderDelegate from '../../render-delegate';

export class BuildDomDelegate implements DomDelegate {
  readonly #document: SimpleDocument | Document;
  readonly #getInitial: (doc: SimpleDocument | Document) => SimpleElement;

  constructor({ document: doc, getInitialElement: getInitial }: RenderDelegate['dom']) {
    this.#document = doc;
    this.#getInitial = getInitial;
  }

  getInitialElement(): SimpleElement {
    return this.#getInitial(this.#document);
  }

  get doc() {
    return castToSimple(this.#document);
  }

  createElement(tagName: string): SimpleElement {
    return this.doc.createElement(tagName);
  }

  createTextNode(content: string): SimpleText {
    return this.doc.createTextNode(content);
  }

  createElementNS(namespace: ElementNamespace, tagName: string): SimpleElement {
    return this.doc.createElementNS(namespace, tagName);
  }

  createDocumentFragment(): SimpleDocumentFragment {
    return this.doc.createDocumentFragment();
  }
}
