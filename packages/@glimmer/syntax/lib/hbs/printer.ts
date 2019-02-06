import * as hbs from '../types/handlebars-ast';

export class Printer {
  print(ast: hbs.AnyProgram): string {
    console.log(ast);
    return this.top(ast, 0) + '\n';
  }

  top(ast: hbs.AnyProgram, size: number): string {
    let out = [];

    console.log(ast);
    for (let item of ast.body) {
      out.push(this.visit(item, size));
    }

    return out.join('\n');
  }

  visit(item: hbs.Statement | hbs.Program, size = 0): string {
    switch (item.type) {
      case 'CommentStatement':
        return indent(`{{! '${item.value}' }}`, size);

      case 'ContentStatement':
        return indent(`CONTENT[ '${item.value}' ]`, size);

      case 'BlockStatement': {
        let out = [];
        out.push(indent(this.mustacheBody(item, true), size));
        out.push(indent('PROGRAM:', size + 1));
        if (item.program.body.length) {
          out.push(this.top(item.program, size + 2));
        }

        if (item.inverse) {
          out.push(indent('{{else}}', size + 1));
          if (item.inverse.body.length) {
            out.push(this.top(item.inverse, size + 2));
          }
        }

        return out.join('\n');
      }

      case 'MustacheStatement': {
        return indent(this.mustacheBody(item, false), size);
      }

      default:
        throw new Error(`unimplemented Printer for ${item.type}`);
    }
  }

  mustacheBody(item: hbs.MustacheBody, block: boolean): string {
    let params = [];

    for (let param of item.params) {
      params.push(this.expr(param));
    }

    let hash = '';

    if (item.hash.pairs.length > 0) {
      let parts = [];
      for (let pair of item.hash.pairs) {
        parts.push(`${pair.key}=${this.expr(pair.value)}`);
      }
      hash = ` HASH{${parts.join(', ')}}`;
    }

    return `{{${block ? '#' : ''} ${this.expr(item.path)} [${params.join(', ')}]${hash} }}`;
  }

  expr(item: hbs.Expression): string {
    switch (item.type) {
      case 'PathExpression':
        if (item.data) {
          return `@PATH:${item.parts.join('.')}`;
        } else {
          return `PATH:${item.parts.join('.')}`;
        }

      case 'NumberLiteral':
        return `NUMBER{${String(item.value)}}`;

      case 'StringLiteral':
        return `${JSON.stringify(item.value)}`;

      case 'BooleanLiteral':
        return `BOOLEAN{${item.value}}`;

      case 'UndefinedLiteral':
        return 'UNDEFINED';

      case 'NullLiteral':
        return 'NULL';

      default:
        throw new Error(`unimplemented Printer for ${item.type}`);
    }
  }
}

function indent(body: string, size: number): string {
  let lines = body.split('\n');

  let out = [];

  for (let line of lines) {
    out.push(`${'  '.repeat(size)}${line}`);
  }

  return out.join('\n');
}
