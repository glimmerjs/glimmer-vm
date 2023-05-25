import Printer from '../../generation/printer';
import type * as ASTv1 from '../../v1/api';

export function printPath(node: ASTv1.PathExpression | ASTv1.CallNode): string {
  return node.type !== 'PathExpression' && node.path.type === 'PathExpression'
    ? printPath(node.path)
    : new Printer({ entityEncoding: 'raw' }).print(node);
}

export function printHead(node: ASTv1.PathExpression | ASTv1.CallNode): string {
  if (node.type === 'PathExpression') {
    switch (node.head.type) {
      case 'AtHead':
      case 'VarHead':
        return node.head.name;
      case 'ThisHead':
        return 'this';
    }
  } else if (node.path.type === 'PathExpression') {
    return printHead(node.path);
  } else {
    return new Printer({ entityEncoding: 'raw' }).print(node);
  }
}
