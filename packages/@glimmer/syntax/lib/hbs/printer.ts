import * as hbs from '../types/handlebars-ast';
import { JsonValue } from '@glimmer/interfaces';
import { unwrap } from '@glimmer/util';

export class Printer {
  print(ast: hbs.AnyProgram): JsonValue {
    console.log(ast);
    return ['concat', this.top(ast)];
  }

  top(ast: hbs.AnyProgram): JsonValue {
    let out = [];

    console.log(ast);

    if (ast.body) {
      for (let item of ast.body) {
        out.push(this.visit(item));
      }
    }

    return out;
  }

  visit(item: hbs.Statement | hbs.Program): JsonValue {
    switch (item.type) {
      case 'CommentStatement':
        return ['comment', item.value];

      case 'ContentStatement':
        return `s:${item.value}`;

      case 'BlockStatement': {
        let sexp: JsonValue[] = ['block'];
        let blocks: JsonValue = {};
        sexp.push(...this.mustacheBody(unwrap(item.program.call), item.program.blockParams));
        blocks.default = this.top(item.program);

        if (item.inverses) {
          blocks.else = item.inverses.map(inverse => {
            return this.top(inverse);
          });
        }

        sexp.push(blocks);

        return sexp;
      }

      case 'MustacheStatement': {
        return this.mustacheBody(item.body);
      }

      case 'MustacheContent':
        return this.expr(item.value);

      case 'Newline':
        return '\n';

      default:
        throw new Error(`unimplemented Printer for ${item.type}`);
    }
  }

  mustacheBody(item: hbs.CallBody, blockParams?: string[] | null): JsonValue[] {
    let sexp = [];

    sexp.push(this.expr(item.call));

    if (item.params) {
      for (let param of item.params) {
        sexp.push(this.expr(param));
      }
    }

    if (item.hash) {
      let hash: JsonValue = {};
      for (let pair of item.hash.pairs) {
        hash[pair.key] = this.expr(pair.value);
      }
      sexp.push(hash);
    }

    if (blockParams && blockParams.length) sexp.push({ as: blockParams });
    return sexp;
  }

  expr(item: hbs.Expression): JsonValue | JsonValue[] {
    switch (item.type) {
      case 'PathExpression': {
        if (item.tail) {
          let out = ['get-path', this.head(item.head)];
          if (item.tail.length) out.push(...this.segments(item.tail));
          return out;
        } else {
          return this.head(item.head);
        }
      }

      case 'NumberLiteral':
        return item.value;

      case 'StringLiteral':
        return `s:${item.value}`;

      case 'BooleanLiteral':
        return `%${item.value}%`;

      case 'UndefinedLiteral':
        return '%undefined%';

      case 'NullLiteral':
        return '%null%';

      case 'SubExpression':
        return this.subexpr(item);
    }
  }

  subexpr(item: hbs.SubExpression): JsonValue[] {
    return this.mustacheBody(item.body);
  }

  head(item: hbs.Head): JsonValue {
    switch (item.type) {
      case 'ArgReference':
        return `@${item.name}`;
      case 'LocalReference':
        return item.name;
      case 'This':
        return '%this%';
    }
  }

  segments(segments: hbs.PathSegment[]): string[] {
    return segments.map(s => `s:${s.name}`);
  }
}
