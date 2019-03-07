import * as hbs from '../types/handlebars-ast';
import { unreachable, assign } from '@glimmer/util';

export function combineContent<T extends hbs.AnyProgram>(program: T): T {
  let statements: hbs.Statement[] = [];
  let body = program.body;

  if (body === null) {
    return program;
  }

  for (let i = 0; i < body.length; i++) {
    let item = body[i];

    if (isContent(item)) {
      while (true) {
        let next = body[i + 1];

        if (isContent(next)) {
          i++;
          item = join(item, next);
        } else {
          item = join(item);
          break;
        }
      }
    } else if (item.type === 'BlockStatement') {
      item.program = combineContent(item.program);
      if (item.inverses) {
        item.inverses = item.inverses.map(inverse => combineContent(inverse));
      }
    } else if (item.type === 'ElementNode') {
      if (item.body) item.body = combineContent(item.body);
    }

    statements.push(item);
  }

  return assign(program, { body: statements });
}

type Content = hbs.TextNode | hbs.Newline;

function isContent(item: hbs.Statement | undefined): item is Content {
  return item !== undefined && (item.type === 'TextNode' || item.type === 'Newline');
}

function join(left: Content, right?: Content): hbs.TextNode {
  let span = { start: left.span.start, end: right ? right.span.end : left.span.end };
  let value: string;

  if (right === undefined) {
    if (left.type === 'Newline') {
      value = '\n';
    } else {
      value = left.value;
    }
  } else if (left.type === 'Newline' && right.type === 'Newline') {
    value = '\n\n';
  } else if (left.type === 'Newline' && right.type === 'TextNode') {
    value = `\n${right.value}`;
  } else if (left.type === 'TextNode' && right.type === 'Newline') {
    value = `${left.value}\n`;
  } else if (left.type === 'TextNode' && right.type === 'TextNode') {
    value = `${left.value}${right.value}`;
  } else {
    throw unreachable();
  }

  return {
    type: 'TextNode',
    span,
    value,
  };
}
