export default function print(ast, source) {
  if (typeof source === 'string') {
    let lines = source.split(/(?:\r\n?|\n)/g);
    return build(ast, { lines });
  } else {
    return build(ast);
  }
}

function build(ast, source) {
  if(!ast) {
    return '';
  }

  const output = [];

  switch(ast.type) {
    case 'Program': {
      const chainBlock = ast.chained && ast.body[0];
      if(chainBlock) {
        chainBlock.chained = true;
      }
      const body = buildEach(ast.body, source).join('');
      output.push(body);
    }
    break;
    case 'ElementNode':
      output.push('<', ast.tag);
      if(ast.attributes.length) {
        output.push(' ', buildEach(ast.attributes, source).join(' '));
      }
      if(ast.modifiers.length) {
        output.push(' ', buildEach(ast.modifiers, source).join(' '));
      }
      if(ast.comments.length) {
        output.push(' ', buildEach(ast.comments, source).join(' '));
      }
      output.push('>');
      output.push.apply(output, buildEach(ast.children, source));
      output.push('</', ast.tag, '>');
    break;
    case 'AttrNode':
      output.push(ast.name, '=');
      const value = build(ast.value, source);
      if(ast.value.type === 'TextNode') {
        output.push('"', value, '"');
      } else {
        output.push(value);
      }
    break;
    case 'ConcatStatement':
      output.push('"');
      ast.parts.forEach(function(node) {
        if(node.type === 'StringLiteral') {
          output.push(node.original);
        } else {
          output.push(build(node, source));
        }
      });
      output.push('"');
    break;
    case 'TextNode':
      output.push(ast.chars);
    break;
    case 'MustacheStatement': {
      output.push(compactJoin(['{{', pathParams(ast, source), '}}']));
    }
    break;
    case 'MustacheCommentStatement': {
      if (source) {
        let line = source.lines[ast.loc.start.line - 1];
        if (line.substr(ast.loc.start.column, 5) === '{{!--') {
          output.push(compactJoin(['{{!--', ast.value, '--}}']));
        } else {
          output.push(compactJoin(['{{!', ast.value, '}}']));
        }
      } else {
        output.push(compactJoin(['{{!--', ast.value, '--}}']));
      }
    }
    break;
    case 'ElementModifierStatement': {
      output.push(compactJoin(['{{', pathParams(ast, source), '}}']));
    }
    break;
    case 'PathExpression':
      output.push(ast.original);
    break;
    case 'SubExpression': {
      output.push('(', pathParams(ast, source), ')');
    }
    break;
    case 'BooleanLiteral':
      output.push(ast.value ? 'true' : false);
    break;
    case 'BlockStatement': {
      const lines = [];

      if(ast.chained){
        lines.push(['{{else ', pathParams(ast, source), '}}'].join(''));
      }else{
        lines.push(openBlock(ast, source));
      }

      lines.push(build(ast.program, source));

      if(ast.inverse) {
        if(!ast.inverse.chained){
          lines.push('{{else}}');
        }
        lines.push(build(ast.inverse, source));
      }

      if(!ast.chained){
        lines.push(closeBlock(ast, source));
      }

      output.push(lines.join(''));
    }
    break;
    case 'PartialStatement': {
      output.push(compactJoin(['{{>', pathParams(ast, source), '}}']));
    }
    break;
    case 'CommentStatement': {
      output.push(compactJoin(['<!--', ast.value, '-->']));
    }
    break;
    case 'StringLiteral': {
      output.push(`"${ast.value}"`);
    }
    break;
    case 'NumberLiteral': {
      output.push(ast.value);
    }
    break;
    case 'UndefinedLiteral': {
      output.push('undefined');
    }
    break;
    case 'NullLiteral': {
      output.push('null');
    }
    break;
    case 'Hash': {
      output.push(ast.pairs.map(function(pair) {
        return build(pair, source);
      }).join(' '));
    }
    break;
    case 'HashPair': {
      output.push(`${ast.key}=${build(ast.value, source)}`);
    }
    break;
  }
  return output.join('');
}

function compact(array) {
  const newArray = [];
  array.forEach(function(a) {
    if(typeof(a) !== 'undefined' && a !== null && a !== '') {
      newArray.push(a);
    }
  });
  return newArray;
}

function buildEach(asts, source) {
  const output = [];
  asts.forEach(function(node) {
    output.push(build(node, source));
  });
  return output;
}

function pathParams(ast, source) {
  const name = build(ast.name, source);
  const path = build(ast.path, source);
  const params = buildEach(ast.params, source).join(' ');
  const hash = build(ast.hash, source);
  return compactJoin([name, path, params, hash], ' ');
}

function compactJoin(array, delimiter?) {
  return compact(array).join(delimiter || '');
}

function blockParams(block) {
  const params = block.program.blockParams;
  if(params.length) {
    return ` as |${params.join(' ')}|`;
  }
}

function openBlock(block, source) {
  return ['{{#', pathParams(block, source), blockParams(block), '}}'].join('');
}

function closeBlock(block, source) {
  return ['{{/', build(block.path, source), '}}'].join('');
}
