import { Node } from '../types/nodes-v1';
import Printer, { PrinterOptions } from './printer';

export default function build(
  ast: Node,
  options: PrinterOptions = { entityEncoding: 'transformed' }
): string {
  if (!ast) {
    return '';
  }

  let printer = new Printer(options);
  return printer.print(ast);
}
