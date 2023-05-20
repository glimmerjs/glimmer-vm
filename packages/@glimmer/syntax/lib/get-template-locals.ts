import { isKeyword } from './keywords';
import { preprocess } from './parser/tokenizer-event-handlers';
import traverse from './traversal/traverse';
import type * as ASTv1 from './v1/api';

interface GetTemplateLocalsOptions {
  includeKeywords?: boolean;
  includeHtmlElements?: boolean;
}

/**
 * Gets the correct Token from the Node based on it's type
 */
function tokensFromType(
  node: ASTv1.Node,
  scopedTokens: string[],
  options: GetTemplateLocalsOptions | undefined
): string | void {
  if (node.type === 'PathExpression') {
    if (node.head.type === 'AtHead' || node.head.type === 'ThisHead') {
      return;
    }

    let possbleToken = node.head.name;

    if (!scopedTokens.includes(possbleToken)) {
      return possbleToken;
    }
  } else if (node.type === 'ElementNode') {
    let { tag } = node;

    let char = tag.charAt(0);

    if (char === ':' || char === '@') {
      return;
    }

    if (!options?.includeHtmlElements && !tag.includes('.') && tag.toLowerCase() === tag) {
      return;
    }

    if (tag.slice(0, 5) === 'this.') {
      return;
    }

    // the tag may be from a yielded object
    // example:
    //   <x.button>
    // An ElementNode does not parse the "tag" in to a PathExpression
    // so we have to split on `.`, just like how `this` presence is checked.
    if (tag.includes('.')) {
      let [potentialLocal] = tag.split('.') as [string, ...string[]];

      if (scopedTokens.includes(potentialLocal)) return;
    }

    if (scopedTokens.includes(tag)) return;

    return tag;
  }
}

/**
 * Adds tokens to the tokensSet based on their node.type
 */
function addTokens(
  tokensSet: Set<string>,
  node: ASTv1.Node,
  scopedTokens: string[],
  options: GetTemplateLocalsOptions | undefined
) {
  let maybeTokens = tokensFromType(node, scopedTokens, options);

  for (let maybeToken of Array.isArray(maybeTokens) ? maybeTokens : [maybeTokens]) {
    if (maybeToken !== undefined && maybeToken[0] !== '@') {
      let maybeTokenFirstSegment = maybeToken.split('.')[0];
      if (!scopedTokens.includes(maybeTokenFirstSegment)) {
        tokensSet.add(maybeToken.split('.')[0]);
      }
    }
  }
}

/**
 * Parses and traverses a given handlebars html template to extract all template locals
 * referenced that could possible come from the parent scope. Can exclude known keywords
 * optionally.
 */
export function getTemplateLocals(html: string, options?: GetTemplateLocalsOptions): string[] {
  let ast = preprocess(html);
  let tokensSet = new Set<string>();
  let scopedTokens: string[] = [];

  traverse(ast, {
    Block: {
      enter({ blockParams }) {
        for (let parameter of blockParams) {
          scopedTokens.push(parameter);
        }
      },

      exit({ blockParams }) {
        for (let _ of blockParams) scopedTokens.pop();
      },
    },

    ElementNode: {
      enter(node) {
        for (let parameter of node.blockParams) {
          scopedTokens.push(parameter);
        }
        addTokens(tokensSet, node, scopedTokens, options);
      },

      exit({ blockParams }) {
        for (let _ of blockParams) scopedTokens.pop();
      },
    },

    PathExpression(node) {
      addTokens(tokensSet, node, scopedTokens, options);
    },
  });

  let tokens: string[] = [];

  for (let s of tokensSet) tokens.push(s);

  if (!options?.includeKeywords) {
    tokens = tokens.filter((token) => !isKeyword(token));
  }

  return tokens;
}
