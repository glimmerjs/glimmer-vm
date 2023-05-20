import type { Nullable } from '@glimmer/interfaces';
import { expect, unwrap } from '@glimmer/util';

import { generateSyntaxError } from './syntax-error';
import type * as ASTv1 from './v1/api';
import type * as HBS from './v1/handlebars-ast';

// Regex to validate the identifier for block parameters.
// Based on the ID validation regex in Handlebars.

let ID_INVERSE_PATTERN = /[!"#%&'()*+./;<=>@[\\\]^`{|}~]/u;

// Checks the element's attributes to see if it uses block params.
// If it does, registers the block params with the program and
// removes the corresponding attributes from the element.

export function parseElementBlockParams(element: ASTv1.ElementNode): void {
  let parameters = parseBlockParameters(element);
  if (parameters) element.blockParams = parameters;
}

function parseBlockParameters(element: ASTv1.ElementNode): Nullable<string[]> {
  let l = element.attributes.length;
  let attributeNames = [];

  for (let index = 0; index < l; index++) {
    attributeNames.push(unwrap(element.attributes[index]).name);
  }

  let asIndex = attributeNames.indexOf('as');

  if (
    asIndex === -1 &&
    attributeNames.length > 0 &&
    unwrap(attributeNames.at(-1)).charAt(0) === '|'
  ) {
    throw generateSyntaxError(
      'Block parameters must be preceded by the `as` keyword, detected block parameters without `as`',
      element.loc
    );
  }

  if (asIndex !== -1 && l > asIndex && unwrap(attributeNames[asIndex + 1]).charAt(0) === '|') {
    // Some basic validation, since we're doing the parsing ourselves
    let parametersString = attributeNames.slice(asIndex).join(' ');
    if (
      parametersString.charAt(parametersString.length - 1) !== '|' ||
      expect(parametersString.match(/\|/gu), `block params must exist here`).length !== 2
    ) {
      throw generateSyntaxError(
        "Invalid block parameters syntax, '" + parametersString + "'",
        element.loc
      );
    }

    let parameters = [];
    for (let index = asIndex + 1; index < l; index++) {
      let parameter = unwrap(attributeNames[index]).replaceAll('|', '');
      if (parameter !== '') {
        if (ID_INVERSE_PATTERN.test(parameter)) {
          throw generateSyntaxError(
            "Invalid identifier for block parameters, '" + parameter + "'",
            element.loc
          );
        }
        parameters.push(parameter);
      }
    }

    if (parameters.length === 0) {
      throw generateSyntaxError('Cannot use zero block parameters', element.loc);
    }

    element.attributes = element.attributes.slice(0, asIndex);
    return parameters;
  }

  return null;
}

export function childrenFor(
  node: ASTv1.Block | ASTv1.Template | ASTv1.ElementNode
): ASTv1.TopLevelStatement[] {
  switch (node.type) {
    case 'Block':
    case 'Template':
      return node.body;
    case 'ElementNode':
      return node.children;
  }
}

export function appendChild(
  parent: ASTv1.Block | ASTv1.Template | ASTv1.ElementNode,
  node: ASTv1.Statement
): void {
  childrenFor(parent).push(node);
}

export function isHBSLiteral(path: HBS.Expression): path is HBS.Literal;
export function isHBSLiteral(path: ASTv1.Expression): path is ASTv1.Literal;
export function isHBSLiteral(
  path: HBS.Expression | ASTv1.Expression
): path is HBS.Literal | ASTv1.Literal {
  return (
    path.type === 'StringLiteral' ||
    path.type === 'BooleanLiteral' ||
    path.type === 'NumberLiteral' ||
    path.type === 'NullLiteral' ||
    path.type === 'UndefinedLiteral'
  );
}

export function printLiteral(literal: ASTv1.Literal): string {
  return literal.type === 'UndefinedLiteral' ? 'undefined' : JSON.stringify(literal.value);
}

export function isUpperCase(tag: string): boolean {
  return tag[0] === tag[0]?.toUpperCase() && tag[0] !== tag[0]?.toLowerCase();
}

export function isLowerCase(tag: string): boolean {
  return tag[0] === tag[0]?.toLowerCase() && tag[0] !== tag[0]?.toUpperCase();
}
