import type { Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import { castToSimple, COMMENT_NODE, TEXT_NODE, unwrap } from '@glimmer/util';
import { type EndTag, type Token, tokenize } from 'simple-html-tokenizer';

import { replaceHTML, toInnerHTML } from './dom/simple-utils';

export type IndividualSnapshot = 'up' | 'down' | SimpleNode | Node;
export type NodesSnapshot = IndividualSnapshot[];

export function snapshotIsNode(snapshot: IndividualSnapshot): snapshot is SimpleNode {
  return snapshot !== 'up' && snapshot !== 'down';
}

export function equalTokens(
  testFragment: SimpleElement | Element | string | null,
  testHTML: SimpleElement | Element | string,
  message: Nullable<string> = null
) {
  if (testFragment === null) {
    throw new Error(`Unexpectedly passed null to equalTokens`);
  }

  let fragTokens = generateTokens(testFragment);
  let htmlTokens = generateTokens(testHTML);

  cleanEmberIds(fragTokens.tokens);
  cleanEmberIds(htmlTokens.tokens);

  let equiv = QUnit.equiv(fragTokens.tokens, htmlTokens.tokens);

  if (equiv && fragTokens.html !== htmlTokens.html) {
    QUnit.assert.deepEqual(
      fragTokens.tokens,
      htmlTokens.tokens,
      message || 'expected tokens to match'
    );
  } else {
    QUnit.assert.pushResult({
      result: QUnit.equiv(fragTokens.tokens, htmlTokens.tokens),
      actual: fragTokens.html,
      expected: htmlTokens.html,
      message: message || 'expected tokens to match',
    });
  }

  // QUnit.assert.deepEqual(fragTokens.tokens, htmlTokens.tokens, msg);
}

function cleanEmberIds(tokens: Token[]) {
  let id = 0;

  for (let token of tokens) {
    let idAttribute = 'attributes' in token && token.attributes.find((a) => a[0] === 'id');

    if (idAttribute) {
      idAttribute[1] = idAttribute[1].replace(/ember(\d+|\*)/u, `ember${++id}`);
    }
  }
}

function isMarker(node: SimpleNode) {
  if (node.nodeType === COMMENT_NODE && node.nodeValue === '') {
    return true;
  }

  if (node.nodeType === TEXT_NODE && node.nodeValue === '') {
    return true;
  }

  return false;
}

export function generateSnapshot(element: SimpleElement): SimpleNode[] {
  let snapshot: SimpleNode[] = [];
  let node: Nullable<SimpleNode> = element.firstChild;

  while (node) {
    if (!isMarker(node)) {
      snapshot.push(node);
    }
    node = node.nextSibling;
  }

  return snapshot;
}

function generateTokens(divOrHTML: SimpleElement | Element | string): {
  tokens: Token[];
  html: string;
} {
  let div: SimpleElement | Element;
  if (typeof divOrHTML === 'string') {
    div = castToSimple(document.createElement('div'));
    replaceHTML(div, divOrHTML);
  } else {
    div = divOrHTML;
  }

  let tokens = tokenize(toInnerHTML(div), {});

  tokens = tokens.flatMap((token) => {
    if (token.type === 'StartTag') {
      if (token.attributes) {
        token.attributes.sort((a, b) => {
          if (a[0] > b[0]) {
            return 1;
          }
          if (a[0] < b[0]) {
            return -1;
          }
          return 0;
        });
      }

      if (token.selfClosing) {
        token.selfClosing = false;
        tokens.push(token, { type: 'EndTag', tagName: token.tagName } as EndTag);
      } else {
        tokens.push(token);
      }
    } else {
      tokens.push(token);
    }

    return tokens;
  });

  return { tokens, html: toInnerHTML(div) };
}

export function equalSnapshots(a: SimpleNode[], b: SimpleNode[]) {
  QUnit.assert.strictEqual(a.length, b.length, 'Same number of nodes');
  for (let [index, element] of b.entries()) {
    QUnit.assert.strictEqual(a[index], element, 'Nodes are the same');
  }
}

export function isServerMarker(node: Node | SimpleNode) {
  return node.nodeType === COMMENT_NODE && node.nodeValue?.charAt(0) === '%';
}

export function normalizeSnapshot(
  oldSnapshot: NodesSnapshot,
  newSnapshot: NodesSnapshot,
  except: SimpleNode[]
): { oldSnapshot: IndividualSnapshot[]; newSnapshot: IndividualSnapshot[] } {
  let oldIterator = new SnapshotIterator(oldSnapshot);
  let newIterator = new SnapshotIterator(newSnapshot);

  let normalizedOld: IndividualSnapshot[] = [];
  let normalizedNew: IndividualSnapshot[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let nextOld = oldIterator.peek();
    let nextNew = newIterator.peek();

    if (nextOld === null && newIterator.peek() === null) break;

    if (
      (nextOld && snapshotIsNode(nextOld) && except.includes(nextOld)) ||
      (nextNew && snapshotIsNode(nextNew) && except.includes(nextNew))
    ) {
      oldIterator.skip();
      newIterator.skip();
    } else {
      normalizedOld.push(oldIterator.next() as IndividualSnapshot);
      normalizedNew.push(newIterator.next() as IndividualSnapshot);
    }
  }

  return { oldSnapshot: normalizedOld, newSnapshot: normalizedNew };
}

class SnapshotIterator {
  private depth = 0;
  private pos = 0;

  constructor(private snapshot: NodesSnapshot) {}

  peek(): Nullable<IndividualSnapshot> {
    if (this.pos >= this.snapshot.length) return null;
    return this.snapshot[this.pos] ?? null;
  }

  next(): Nullable<IndividualSnapshot> {
    if (this.pos >= this.snapshot.length) return null;
    return this.nextNode() || null;
  }

  skip(): void {
    let skipUntil = this.depth;
    this.nextNode();

    if (this.snapshot[this.pos] === 'down') {
      do {
        this.nextNode();
      } while (this.depth !== skipUntil);
    }
  }

  private nextNode(): IndividualSnapshot {
    let token = this.snapshot[this.pos++];

    if (token === 'down') {
      this.depth++;
    } else if (token === 'up') {
      this.depth--;
    }

    return unwrap(token);
  }
}
