import { preprocess as parse, builders as b, ASTv1 } from '..';
import { Dict } from '@glimmer/interfaces';

import { astEqual, gelog } from './support';
import { syntaxErrorFor } from '../../integration-tests';

const test = QUnit.test;

QUnit.module('[le-hbs-syntax] hbs-html - AST');

test('Block helper embedded in an attribute', function () {
  let t = '<img id="cd {{#test a}} hello {{/test}}">';

  astEqual(
    t,
    b.program([
      element('img', [
        'attrs',
        [
          'id',
          b.concat([
            b.text('cd '),
            b.block(b.path('test'), [b.path('a')], b.hash(), b.blockItself([b.text(' hello ')])),
          ]),
        ],
      ]),
    ])
  );
});

test('Block helper in attribute', function () {
  let t = '<img {{#if a}}style="gua"{{/if}} id="cd">';

  astEqual(
    t,
    b.program([
      element(
        'img',
        ['attrs', ['id', b.text('cd')]],
        [
          'modifiers',
          b.block(b.path('if'), [b.path('a')], b.hash(), b.blockItself([b.text('style="gua"')])),
        ]
      ),
    ])
  );
});

test('Dynamic element', function () {
  let t = '<{{tag}}>gua</{{tag}}>';

  astEqual(
    t,
    b.program([element('', ['body', b.text('gua')], ['parts', b.mustache(b.path('tag'))])])
  );
});

test('Support unclose end tag', function () {
  let t = `{{#if valid}}hello</div>{{/if}}`;

  astEqual(
    t,
    b.program([
      b.block(
        b.path('if'),
        [b.path('valid')],
        b.hash(),
        b.blockItself([element('div', ['body', b.text('hello')], ['openedType', 'endTag'])])
      ),
    ])
  );
});

test('Support unclose start tag', function () {
  let t = `{{#if valid}}<div class="container"><div class="content">{{/if}}`;

  astEqual(
    t,
    b.program([
      b.block(
        b.path('if'),
        [b.path('valid')],
        b.hash(),
        b.blockItself([
          element(
            'div',
            ['attrs', ['class', b.text('container')]],
            ['openedType', 'startTag'],
            [
              'body',
              element('div', ['attrs', ['class', b.text('content')]], ['openedType', 'startTag']),
            ]
          ),
        ])
      ),
    ])
  );
});

QUnit.dump.maxDepth = 100;

export function strip(strings: TemplateStringsArray, ...args: string[]) {
  return strings
    .map((str: string, i: number) => {
      return `${str
        .split('\n')
        .map((s) => s.trim())
        .join('')}${args[i] ? args[i] : ''}`;
    })
    .join('');
}

export type ElementParts =
  | ['attrs', ...AttrSexp[]]
  | ['modifiers', ...ModifierSexp[]]
  | ['body', ...ASTv1.Statement[]]
  | ['comments', ...ElementComment[]]
  | ['as', ...string[]]
  | ['loc', ASTv1.SourceLocation]
  | ['parts', ...ASTv1.MustacheStatement[]]
  | ['openedType', 'startTag' | 'endTag' | ''];

export type PathSexp = string | ['path', string, LocSexp?];

export type ModifierSexp =
  | string
  | ASTv1.BlockStatement
  | [PathSexp, LocSexp?]
  | [PathSexp, ASTv1.Expression[], LocSexp?]
  | [PathSexp, ASTv1.Expression[], Dict<ASTv1.Expression>, LocSexp?];

export type AttrSexp = [string, ASTv1.AttrNode['value'] | string, LocSexp?];

export type LocSexp = ['loc', ASTv1.SourceLocation];

export type ElementComment = ASTv1.MustacheCommentStatement | ASTv1.SourceLocation | string;

export type SexpValue =
  | string
  | ASTv1.Expression[]
  | Dict<ASTv1.Expression>
  | LocSexp
  | PathSexp
  | undefined;

export interface BuildElementOptions {
  attrs?: ASTv1.AttrNode[];
  modifiers?: ASTv1.ElementModifierStatement[];
  children?: ASTv1.Statement[];
  comments?: ElementComment[];
  blockParams?: string[];
  loc?: ASTv1.SourceLocation;
  isDynamic?: boolean;
  parts?: ASTv1.MustacheStatement[];
  opened?: boolean;
  openedType?: 'startTag' | 'endTag' | '';
}

export type TagDescriptor = string | { name: string; selfClosing: boolean };

export function element(tag: TagDescriptor, ...options: ElementParts[]): ASTv1.ElementNode {
  let normalized: BuildElementOptions;
  if (Array.isArray(options)) {
    normalized = normalizeElementParts(...options);
  } else {
    normalized = options || {};
  }

  let {
    attrs,
    blockParams,
    modifiers,
    comments,
    children,
    loc,
    parts = [],
    openedType = '',
  } = normalized;

  // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST
  let selfClosing = false;
  if (typeof tag === 'object') {
    selfClosing = tag.selfClosing;
    tag = tag.name;
  } else {
    if (tag.slice(-1) === '/') {
      tag = tag.slice(0, -1);
      selfClosing = true;
    }
  }

  return {
    type: 'ElementNode',
    tag: tag || '',
    selfClosing: selfClosing,
    attributes: attrs || [],
    blockParams: blockParams || [],
    modifiers: modifiers || [],
    comments: (comments as ASTv1.MustacheCommentStatement[]) || [],
    children: children || [],
    loc: b.loc(loc || null),
    isDynamic: parts.length > 0,
    parts,
    opened: Boolean(openedType),
    openedType,
  };
}

export function normalizeElementParts(...args: ElementParts[]): BuildElementOptions {
  let out: BuildElementOptions = {};

  for (let arg of args) {
    switch (arg[0]) {
      case 'attrs': {
        let [, ...rest] = arg;
        out.attrs = rest.map(normalizeAttr);
        break;
      }
      case 'modifiers': {
        let [, ...rest] = arg;
        out.modifiers = rest.map(normalizeModifier);
        break;
      }
      case 'body': {
        let [, ...rest] = arg;
        out.children = rest;
        break;
      }
      case 'comments': {
        let [, ...rest] = arg;

        out.comments = rest;
        break;
      }
      case 'as': {
        let [, ...rest] = arg;
        out.blockParams = rest;
        break;
      }
      case 'loc': {
        let [, rest] = arg;
        out.loc = rest;
        break;
      }
      case 'parts': {
        let [, ...rest] = arg;
        out.parts = rest;
        break;
      }
      case 'openedType': {
        let [, openedType] = arg;
        out.openedType = openedType;
        break;
      }
    }
  }

  return out;
}

export function normalizeAttr(sexp: AttrSexp): ASTv1.AttrNode {
  let name = sexp[0];
  let value;

  if (typeof sexp[1] === 'string') {
    value = b.text(sexp[1]);
  } else {
    value = sexp[1];
  }

  return b.attr(name, value);
}

export function normalizeModifier(
  sexp: ModifierSexp
): ASTv1.ElementModifierStatement | ASTv1.BlockStatement {
  if (typeof sexp === 'string') {
    return b.elementModifier(sexp);
  }

  if (sexp?.type === 'BlockStatement') {
    return sexp as ASTv1.BlockStatement;
  }

  let path: ASTv1.Expression = normalizeHead(sexp[0]);
  let params: ASTv1.Expression[] | undefined;
  let hash: ASTv1.Hash | undefined;
  let loc: ASTv1.SourceLocation | null = null;

  let parts = sexp.slice(1);
  let next = parts.shift();

  _process: {
    if (isParamsSexp(next)) {
      params = next as ASTv1.Expression[];
    } else {
      break _process;
    }

    next = parts.shift();

    if (isHashSexp(next)) {
      hash = normalizeHash(next as Dict<ASTv1.Expression>);
    } else {
      break _process;
    }
  }

  if (isLocSexp(next)) {
    loc = next[1];
  }

  return {
    type: 'ElementModifierStatement',
    path,
    params: params || [],
    hash: hash || b.hash([]),
    loc: b.loc(loc || null),
  };
}

export function normalizeHead(path: PathSexp): ASTv1.Expression {
  if (typeof path === 'string') {
    return b.path(path);
  } else {
    return b.path(path[1], path[2] && path[2][1]);
  }
}

export function normalizeHash(
  hash: Dict<ASTv1.Expression>,
  loc?: ASTv1.SourceLocation
): ASTv1.Hash {
  let pairs: ASTv1.HashPair[] = [];

  Object.keys(hash).forEach((key) => {
    pairs.push(b.pair(key, hash[key]));
  });

  return b.hash(pairs, loc);
}

export function isParamsSexp(value: SexpValue): value is ASTv1.Expression[] {
  return Array.isArray(value) && !isLocSexp(value);
}

export function isLocSexp(value: SexpValue): value is LocSexp {
  return Array.isArray(value) && value.length === 2 && value[0] === 'loc';
}

export function isHashSexp(value: SexpValue): value is Dict<ASTv1.Expression> {
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    expectType<Dict<ASTv1.Expression>>(value);
    return true;
  } else {
    return false;
  }
}

function expectType<T>(_input: T): void {
  return;
}
