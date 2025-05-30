import type * as ASTv1 from '../v1/api';

const Char = {
  NBSP: 0xa0,
  QUOT: 0x22,
  LT: 0x3c,
  GT: 0x3e,
  AMP: 0x26,
};

// \x26 is ampersand, \xa0 is non-breaking space
const ATTR_VALUE_REGEX_TEST = /["\x26\xa0]/u;
const ATTR_VALUE_REGEX_REPLACE = new RegExp(ATTR_VALUE_REGEX_TEST.source, 'gu');

const TEXT_REGEX_TEST = /[&<>\xa0]/u;
const TEXT_REGEX_REPLACE = new RegExp(TEXT_REGEX_TEST.source, 'gu');

function attrValueReplacer(char: string): string {
  switch (char.charCodeAt(0)) {
    case Char.NBSP:
      return '&nbsp;';
    case Char.QUOT:
      return '&quot;';
    case Char.AMP:
      return '&amp;';
    default:
      return char;
  }
}

function textReplacer(char: string): string {
  switch (char.charCodeAt(0)) {
    case Char.NBSP:
      return '&nbsp;';
    case Char.AMP:
      return '&amp;';
    case Char.LT:
      return '&lt;';
    case Char.GT:
      return '&gt;';
    default:
      return char;
  }
}

export function escapeAttrValue(attrValue: string): string {
  if (ATTR_VALUE_REGEX_TEST.test(attrValue)) {
    return attrValue.replace(ATTR_VALUE_REGEX_REPLACE, attrValueReplacer);
  }
  return attrValue;
}

export function escapeText(text: string): string {
  if (TEXT_REGEX_TEST.test(text)) {
    return text.replace(TEXT_REGEX_REPLACE, textReplacer);
  }
  return text;
}

export function sortByLoc(a: ASTv1.Node, b: ASTv1.Node): -1 | 0 | 1 {
  // If either is invisible, don't try to order them
  if (a.loc.isInvisible || b.loc.isInvisible) {
    return 0;
  }

  if (a.loc.startPosition.line < b.loc.startPosition.line) {
    return -1;
  }

  if (
    a.loc.startPosition.line === b.loc.startPosition.line &&
    a.loc.startPosition.column < b.loc.startPosition.column
  ) {
    return -1;
  }

  if (
    a.loc.startPosition.line === b.loc.startPosition.line &&
    a.loc.startPosition.column === b.loc.startPosition.column
  ) {
    return 0;
  }

  return 1;
}
