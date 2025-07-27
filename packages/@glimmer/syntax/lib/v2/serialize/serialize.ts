import type { PresentArray } from '@glimmer/interfaces';
import { exhausted } from '@glimmer/debug-util';

import type * as ASTv2 from '../api';
import type {
  SerializedAppendContent,
  SerializedArgReference,
  SerializedArgs,
  SerializedAttrOrArg,
  SerializedBlock,
  SerializedCallExpression,
  SerializedContentNode,
  SerializedElementModifier,
  SerializedExpressionNode,
  SerializedGlimmerComment,
  SerializedHtmlComment,
  SerializedHtmlOrSplatAttr,
  SerializedHtmlText,
  SerializedInterpolateExpression,
  SerializedInvokeAngleBracketComponent,
  SerializedInvokeBlockComponent,
  SerializedLiteralExpression,
  SerializedLocalVarReference,
  SerializedNamed,
  SerializedNamedArgument,
  SerializedNamedBlock,
  SerializedNamedBlocks,
  SerializedPathExpression,
  SerializedPositional,
  SerializedResolvedVarReference,
  SerializedSimpleElement,
  SerializedThisReference,
  SerializedVariableReference,
} from './types';

import { SourceSlice } from '../../source/slice';

// ValidatedView for serialization - ensures no UnresolvedBinding nodes
class SerializerView {
  get<T extends { type: string }>(value: T | ASTv2.UnresolvedBinding): T {
    if (value.type === 'UnresolvedBinding') {
      throw new Error(
        `Unresolved binding '${(value as ASTv2.UnresolvedBinding).name}' found during serialization. All bindings should be resolved before serialization.`
      );
    }
    return value as T;
  }
}

const view = new SerializerView();

export class RefSerializer {
  keyword(keyword: ASTv2.KeywordExpression): SerializedResolvedVarReference {
    return {
      type: 'Resolved',
      loc: keyword.loc.serialize(),
      resolution: 'Strict',
      name: keyword.name,
    };
  }

  arg(ref: ASTv2.ArgReference): SerializedArgReference {
    return {
      type: 'Arg',
      loc: ref.loc.serialize(),
      name: ref.name.serialize(),
    };
  }

  resolved(ref: ASTv2.ResolvedVarReference): SerializedResolvedVarReference {
    return {
      type: 'Resolved',
      loc: ref.loc.serialize(),
      resolution: ref.resolution.serialize(),
      name: ref.name,
    };
  }

  local(ref: ASTv2.LocalVarReference): SerializedLocalVarReference {
    return {
      type: 'Local',
      loc: ref.loc.serialize(),
      name: ref.name,
    };
  }

  self(ref: ASTv2.ThisReference): SerializedThisReference {
    return {
      type: 'This',
      loc: ref.loc.serialize(),
    };
  }

  lexical(ref: ASTv2.LexicalVarReference): SerializedLocalVarReference {
    return {
      type: 'Local',
      loc: ref.loc.serialize(),
      name: ref.name,
    };
  }

  resolvedName(ref: ASTv2.ResolvedName): SerializedResolvedVarReference {
    return {
      type: 'Resolved',
      loc: ref.loc.serialize(),
      resolution: 'Strict',
      name: ref.name,
    };
  }
}

const REF = new RefSerializer();

export class ExprSerializer {
  literal(literal: ASTv2.LiteralExpression): SerializedLiteralExpression {
    return {
      type: 'Literal',
      loc: literal.loc.serialize(),
      value: literal.value,
    };
  }

  keyword(keyword: ASTv2.KeywordExpression): SerializedPathExpression {
    return {
      type: 'Path',
      loc: keyword.loc.serialize(),
      ref: REF.keyword(keyword),
      tail: [],
    };
  }

  path(path: ASTv2.PathExpression): SerializedPathExpression {
    const ref = view.get(path.ref);
    return {
      type: 'Path',
      loc: path.loc.serialize(),
      ref: visit.ref(ref),
      tail: path.tail.map((t) => t.serialize()),
    };
  }

  call(call: ASTv2.CallExpression): SerializedCallExpression {
    const callee = view.get(call.callee);
    return {
      type: 'Call',
      loc: call.loc.serialize(),
      callee: visit.expr(callee),
      args: ARGS.args(call.args),
    };
  }

  interpolate(interpolate: ASTv2.InterpolateExpression): SerializedInterpolateExpression {
    return {
      type: 'Interpolate',
      loc: interpolate.loc.serialize(),
      parts: interpolate.parts.map((p) => {
        // Handle special interpolate part nodes
        if ('value' in p && p.type === 'CurlyAttrValue') {
          return visit.expr(p.value);
        }
        // Otherwise it's a regular expression node
        return visit.expr(p as ASTv2.ExpressionValueNode);
      }) as PresentArray<SerializedExpressionNode>,
    };
  }

  resolvedCall(call: ASTv2.ResolvedCallExpression): SerializedCallExpression {
    const resolved = view.get(call.resolved);
    return {
      type: 'Call',
      loc: call.loc.serialize(),
      callee: {
        type: 'Path',
        loc: resolved.loc.serialize(),
        ref: REF.resolvedName(resolved),
        tail: [],
      },
      args: ARGS.args(call.args),
    };
  }
}

const EXPR = new ExprSerializer();

class ArgsSerializer {
  args(args: ASTv2.AnyArgs): SerializedArgs {
    return {
      loc: args.loc.serialize(),
      positional: this.positional(args.positional),
      named: this.named(args.named),
    };
  }

  positional(positional: ASTv2.PositionalArguments): SerializedPositional {
    return {
      loc: positional.loc.serialize(),
      exprs: positional.exprs.map((p) => visit.expr(p)),
    };
  }

  named(named: ASTv2.CurlyNamedArguments | ASTv2.ComponentNamedArguments): SerializedNamed {
    if ('entries' in named) {
      // Handle both types that have entries
      return {
        loc: named.loc.serialize(),
        entries: named.entries.map((e) => {
          if (e.value.type === 'Interpolate') {
            // ComponentArgument has AttrValueNode which needs special handling
            return [e.name.serialize(), visit.attrValue(e.value)];
          } else {
            // CurlyArgument
            return this.entry(e as ASTv2.CurlyArgument);
          }
        }),
      };
    }
    // Shouldn't reach here
    throw new Error('Unexpected named arguments type');
  }

  entry(entry: ASTv2.CurlyArgument): SerializedNamedArgument {
    return [entry.name.serialize(), visit.expr(entry.value)];
  }
}

const ARGS = new ArgsSerializer();

export class ContentSerializer {
  append(node: ASTv2.AppendContent): SerializedAppendContent {
    return {
      type: 'Append',
      loc: node.loc.serialize(),
      value: visit.expr(node.value),
      trusting: node.trusting,
    };
  }

  glimmerComment(node: ASTv2.GlimmerComment): SerializedGlimmerComment {
    return {
      type: 'GlimmerComment',
      loc: node.loc.serialize(),
      text: node.text.serialize(),
    };
  }

  htmlComment(node: ASTv2.HtmlComment): SerializedHtmlComment {
    return {
      type: 'HtmlComment',
      loc: node.loc.serialize(),
      text: node.text.serialize(),
    };
  }

  htmlText(node: ASTv2.HtmlText): SerializedHtmlText {
    return {
      type: 'HtmlText',
      loc: node.loc.serialize(),
      chars: node.chars,
    };
  }

  invokeBlock(node: ASTv2.InvokeBlock): SerializedInvokeBlockComponent {
    let args = ARGS.args(node.args);
    let callee = visit.expr(node.callee);

    return {
      type: 'InvokeBlockComponent',
      loc: node.loc.serialize(),
      args,
      callee,
      blocks: INTERNAL.namedBlocks(node.blocks),
    };
  }

  invokeAngleBracketComponent(
    node: ASTv2.InvokeAngleBracketComponent
  ): SerializedInvokeAngleBracketComponent {
    return {
      type: 'InvokeAngleBracketComponent',
      loc: node.loc.serialize(),
      callee: visit.expr(node.callee),
      blocks: INTERNAL.namedBlocks(node.blocks),
      attrs: node.attrs.map((a) => visit.attr(a)),
      componentArgs: node.componentArgs.map((a) => ATTRS.arg(a)),
      modifiers: node.modifiers.map((m) => ATTRS.modifier(m)),
    };
  }

  simpleElement(node: ASTv2.SimpleElementNode): SerializedSimpleElement {
    return {
      type: 'SimpleElement',
      loc: node.loc.serialize(),
      tag: node.tag.serialize(),
      body: node.body.map((b) => visit.content(b)),
      attrs: node.attrs.map((a) => visit.attr(a)),
      componentArgs: node.componentArgs.map((a) => ATTRS.arg(a)),
      modifiers: node.modifiers.map((m) => ATTRS.modifier(m)),
    };
  }
}

const CONTENT = new ContentSerializer();

class AttrBlockSerializer {
  modifier(node: ASTv2.ElementModifier | ASTv2.ResolvedElementModifier): SerializedElementModifier {
    if (node.type === 'ResolvedElementModifier') {
      // ResolvedElementModifier doesn't have callee, it has a resolved property
      const resolved = view.get(node.resolved);
      return {
        loc: node.loc.serialize(),
        callee: {
          type: 'Path',
          loc: node.loc.serialize(),
          ref: REF.resolvedName(resolved),
          tail: [],
        },
        args: ARGS.args(node.args),
      };
    } else {
      return {
        loc: node.loc.serialize(),
        callee: visit.expr(node.callee),
        args: ARGS.args(node.args),
      };
    }
  }

  arg(node: ASTv2.ComponentArg): SerializedAttrOrArg {
    return this.anyAttr(node);
  }

  anyAttr(node: ASTv2.ComponentArg | ASTv2.HtmlAttr): SerializedAttrOrArg {
    return {
      loc: node.loc.serialize(),
      name: node.name.serialize(),
      value: visit.attrValue(node.value),
      trusting: node.trusting,
    };
  }
}

const ATTRS = new AttrBlockSerializer();

class InternalSerializer {
  block(node: ASTv2.Block): SerializedBlock {
    return {
      loc: node.loc.serialize(),
      body: node.body.map((b) => visit.content(b)),
      table: node.scope.locals,
    };
  }

  namedBlock(node: ASTv2.NamedBlock): SerializedNamedBlock {
    return {
      name: node.name.serialize(),
      block: INTERNAL.block(node.block),
    };
  }

  namedBlocks(node: ASTv2.NamedBlocks): SerializedNamedBlocks {
    return {
      blocks: node.blocks.map((b) => {
        if (b.type === 'Error') {
          throw new Error(`Error node found during serialization in named blocks`);
        }
        return INTERNAL.namedBlock(b);
      }),
      loc: node.loc.serialize(),
    };
  }
}

const INTERNAL = new InternalSerializer();

const visit = {
  attrValue(value: ASTv2.AttrValueNode): SerializedExpressionNode {
    if ('value' in value && value.type === 'CurlyAttrValue') {
      return visit.expr(value.value);
    } else if (value.type === 'Interpolate') {
      return EXPR.interpolate(value);
    } else {
      // It's a regular expression node
      return visit.expr(value as ASTv2.ExpressionValueNode);
    }
  },

  expr(expr: ASTv2.ExpressionValueNode | ASTv2.UnresolvedBinding): SerializedExpressionNode {
    const node = view.get(expr);

    switch (node.type) {
      case 'Literal':
        return EXPR.literal(node);
      case 'Keyword':
        return EXPR.keyword(node);
      case 'Path':
        return EXPR.path(node);
      case 'Call':
        return EXPR.call(node);
      case 'ResolvedCall':
        return EXPR.resolvedCall(node);
      case 'This':
      case 'Arg':
      case 'Local':
      case 'Lexical':
        // Variable references are handled as paths
        return {
          type: 'Path',
          loc: node.loc.serialize(),
          ref: visit.ref(node),
          tail: [],
        };
      case 'Error':
        throw new Error(`Error node found during serialization`);
      default:
        exhausted(node);
    }
  },

  attr(node: ASTv2.HtmlOrSplatAttr): SerializedHtmlOrSplatAttr {
    if (node.type === 'SplatAttr') {
      return new SourceSlice({ loc: node.loc, chars: '...attributes' }).serialize();
    } else {
      return ATTRS.anyAttr(node);
    }
  },

  ref(ref: ASTv2.VariableReference): SerializedVariableReference {
    switch (ref.type) {
      case 'Arg':
        return REF.arg(ref);
      case 'Local':
        return REF.local(ref);
      case 'This':
        return REF.self(ref);
      case 'Lexical':
        return REF.lexical(ref);
      default:
        exhausted(ref);
    }
  },

  content(node: ASTv2.ContentNode): SerializedContentNode {
    switch (node.type) {
      case 'AppendContent':
        return CONTENT.append(node);
      case 'GlimmerComment':
        return CONTENT.glimmerComment(node);
      case 'HtmlComment':
        return CONTENT.htmlComment(node);
      case 'HtmlText':
        return CONTENT.htmlText(node);
      case 'InvokeBlock':
        return CONTENT.invokeBlock(node);
      case 'InvokeAngleBracketComponent':
        return CONTENT.invokeAngleBracketComponent(node);
      case 'SimpleElement':
        return CONTENT.simpleElement(node);
      default:
        throw new Error(`Unexpected content node type: ${node.type}`);
    }
  },
};
