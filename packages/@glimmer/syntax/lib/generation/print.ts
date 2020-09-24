import type { ASTv1 } from '../-internal';
import { Printer, PrinterOptions } from './-internal';

export default function build(
  ast: ASTv1.Node,
  options: PrinterOptions = { entityEncoding: 'transformed' }
): string {
  if (!ast) {
    return '';
  }

  let printer = new Printer(options);
  return printer.print(ast);
}
