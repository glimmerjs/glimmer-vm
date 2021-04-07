import * as ASTv1 from '../v1/api';
import HTMLPrinter from './html-printer';
import Printer, { PrinterOptions } from './printer';

export default function build(
  ast: ASTv1.Node,
  options: PrinterOptions = { entityEncoding: 'transformed', outputEncoding: 'raw' }
): string {
  if (!ast) {
    return '';
  }

  if (options.outputEncoding === 'html') {
    let printer = new HTMLPrinter(options);
    return printer.print(ast);
  } else {
    let printer = new Printer(options);
    return printer.print(ast);
  }
}
