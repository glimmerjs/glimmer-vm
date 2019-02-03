import * as hbs from '../types/handlebars-ast';

export class Printer {
  print(ast: hbs.RootProgram): string {
    let out = ``;

    for (let item of ast.body) {
      out += this.visit(item);
    }

    return out;
  }

  visit(item: hbs.Statement): string {
    switch (item.type) {
      case 'ContentStatement':
        return `CONTENT[ ${item.value} ]`;

      default:
        throw new Error(`unimplemented Printer for ${item.type}`);
    }
  }
}
