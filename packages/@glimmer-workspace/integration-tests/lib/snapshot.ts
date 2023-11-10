import type { Nullable, SimpleElement, SimpleNode } from '@glimmer/interfaces';
import type { EndTag, Token, TokenType } from 'simple-html-tokenizer';
import { castToSimple, COMMENT_NODE, TEXT_NODE, unwrap } from '@glimmer/util';
import { tokenize } from 'simple-html-tokenizer';

import { replaceHTML, toInnerHTML } from './dom/simple-utils';

export type IndividualSnapshot = 'up' | 'down' | SimpleNode;
export type NodesSnapshot = IndividualSnapshot[];

export const DOCTYPE_TOKEN = 'Doctype' as TokenType.Doctype;
export const START_TAG_TOKEN = 'StartTag' as TokenType.StartTag;
export const END_TAG_TOKEN = 'EndTag' as TokenType.EndTag;
export const CHARS_TOKEN = 'Chars' as TokenType.Chars;
export const COMMENT_TOKEN = 'Comment' as TokenType.Comment;

export function snapshotIsNode(snapshot: IndividualSnapshot): snapshot is SimpleNode {
  return snapshot !== 'up' && snapshot !== 'down';
}

export function equalTokens(
  actual: SimpleElement | string | null,
  expected:
    | SimpleElement
    | string
    | {
        expected: string | SimpleElement;
        ignore: 'comments';
      },
  message: Nullable<string> = null
) {
  if (actual === null) {
    throw new Error(`Unexpectedly passed null to equalTokens`);
  }

  const { element: expectedElement, ignoreComments } = extract(expected);
  const expectedTokens = generateTokens(expectedElement, ignoreComments);
  const fragTokens = generateTokens(extract(actual).element, ignoreComments);

  cleanEmberIds(fragTokens.tokens);
  cleanEmberIds(expectedTokens.tokens);

  const equiv = QUnit.equiv(fragTokens.tokens, expectedTokens.tokens);

  if (equiv && fragTokens.html !== expectedTokens.html) {
    QUnit.assert.deepEqual(
      fragTokens.tokens,
      expectedTokens.tokens,
      message || 'expected tokens to match'
    );
  } else {
    QUnit.assert.pushResult({
      result: QUnit.equiv(fragTokens.tokens, expectedTokens.tokens),
      actual: fragTokens.html,
      expected: expectedTokens.html,
      message: message || 'expected tokens to match',
    });
  }

  // QUnit.assert.deepEqual(fragTokens.tokens, htmlTokens.tokens, msg);
}

function cleanEmberIds(tokens: Token[]) {
  let id = 0;

  tokens.forEach((token) => {
    const idAttr = 'attributes' in token && token.attributes.filter((a) => a[0] === 'id')[0];

    if (idAttr) {
      idAttr[1] = idAttr[1].replace(/ember(\d+|\*)/u, `ember${++id}`);
    }
  });
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
  const snapshot: SimpleNode[] = [];
  let node: Nullable<SimpleNode> = element.firstChild;

  while (node) {
    if (!isMarker(node)) {
      snapshot.push(node);
    }
    node = node.nextSibling;
  }

  return snapshot;
}

function extract(
  expected: SimpleElement | string | { expected: string | SimpleElement; ignore: 'comments' }
): {
  ignoreComments: boolean;
  element: SimpleElement;
} {
  if (typeof expected === 'string') {
    const div = castToSimple(document.createElement('div'));
    replaceHTML(div, expected);
    return {
      ignoreComments: false,
      element: div,
    };
  } else if ('nodeType' in expected) {
    return {
      ignoreComments: false,
      element: expected,
    };
  } else {
    return {
      ignoreComments: true,
      element: extract(expected.expected).element,
    };
  }
}

function generateTokens(
  element: SimpleElement,
  ignoreComments: boolean
): {
  tokens: Token[];
  html: string;
} {
  let tokens = tokenize(toInnerHTML(element), {});

  tokens = tokens.reduce((tokens, token) => {
    if (token.type === START_TAG_TOKEN) {
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
        tokens.push(token);
        tokens.push({ type: 'EndTag', tagName: token.tagName } as EndTag);
      } else {
        tokens.push(token);
      }
    } else if (!ignoreComments || token.type !== COMMENT_TOKEN) {
      tokens.push(token);
    }

    return tokens;
  }, new Array<Token>());

  return { tokens, html: toInnerHTML(element) };
}

export function equalSnapshots(a: SimpleNode[], b: SimpleNode[]) {
  QUnit.assert.strictEqual(a.length, b.length, 'Same number of nodes');
  for (let i = 0; i < b.length; i++) {
    QUnit.assert.strictEqual(a[i], b[i], 'Nodes are the same');
  }
}

export function isServerMarker(node: SimpleNode) {
  return node.nodeType === COMMENT_NODE && node.nodeValue.charAt(0) === '%';
}

export function normalizeSnapshot(
  oldSnapshot: NodesSnapshot,
  newSnapshot: NodesSnapshot,
  except: SimpleNode[]
): { oldSnapshot: IndividualSnapshot[]; newSnapshot: IndividualSnapshot[] } {
  const oldIterator = new SnapshotIterator(oldSnapshot);
  const newIterator = new SnapshotIterator(newSnapshot);

  const normalizedOld: IndividualSnapshot[] = [];
  const normalizedNew: IndividualSnapshot[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextOld = oldIterator.peek();
    const nextNew = newIterator.peek();

    if (nextOld === null && newIterator.peek() === null) break;

    if (
      (nextOld && snapshotIsNode(nextOld) && except.indexOf(nextOld) > -1) ||
      (nextNew && snapshotIsNode(nextNew) && except.indexOf(nextNew) > -1)
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
    const skipUntil = this.depth;
    this.nextNode();

    if (this.snapshot[this.pos] === 'down') {
      do {
        this.nextNode();
      } while (this.depth !== skipUntil);
    }
  }

  private nextNode(): IndividualSnapshot {
    const token = this.snapshot[this.pos++];

    if (token === 'down') {
      this.depth++;
    } else if (token === 'up') {
      this.depth--;
    }

    return unwrap(token);
  }
}
