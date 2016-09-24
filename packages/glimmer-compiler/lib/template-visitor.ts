let push = Array.prototype.push;

class Frame {
  public parentNode: Object = null;
  public children: Object = null;
  public childIndex: number = null;
  public childCount: number = null;
  public childTemplateCount: number = 0;
  public mustacheCount: number = 0;
  public actions: any[] = [];
  public blankChildTextNodes: number[] = null;
}

/**
 * Takes in an AST and outputs a list of actions to be consumed
 * by a compiler. For example, the template
 *
 *     foo{{bar}}<div>baz</div>
 *
 * produces the actions
 *
 *     [['startProgram', [programNode, 0]],
 *      ['text', [textNode, 0, 3]],
 *      ['mustache', [mustacheNode, 1, 3]],
 *      ['openElement', [elementNode, 2, 3, 0]],
 *      ['text', [textNode, 0, 1]],
 *      ['closeElement', [elementNode, 2, 3],
 *      ['endProgram', [programNode]]]
 *
 * This visitor walks the AST depth first and backwards. As
 * a result the bottom-most child template will appear at the
 * top of the actions list whereas the root template will appear
 * at the bottom of the list. For example,
 *
 *     <div>{{#if}}foo{{else}}bar<b></b>{{/if}}</div>
 *
 * produces the actions
 *
 *     [['startProgram', [programNode, 0]],
 *      ['text', [textNode, 0, 2, 0]],
 *      ['openElement', [elementNode, 1, 2, 0]],
 *      ['closeElement', [elementNode, 1, 2]],
 *      ['endProgram', [programNode]],
 *      ['startProgram', [programNode, 0]],
 *      ['text', [textNode, 0, 1]],
 *      ['endProgram', [programNode]],
 *      ['startProgram', [programNode, 2]],
 *      ['openElement', [elementNode, 0, 1, 1]],
 *      ['block', [blockNode, 0, 1]],
 *      ['closeElement', [elementNode, 0, 1]],
 *      ['endProgram', [programNode]]]
 *
 * The state of the traversal is maintained by a stack of frames.
 * Whenever a node with children is entered (either a ProgramNode
 * or an ElementNode) a frame is pushed onto the stack. The frame
 * contains information about the state of the traversal of that
 * node. For example,
 *
 *   - index of the current child node being visited
 *   - the number of mustaches contained within its child nodes
 *   - the list of actions generated by its child nodes
 */

export default class TemplateVisitor {
  private frameStack: Frame[] = [];
  public actions: Array<Array<Array<any>>> = [];
  private programDepth: number = -1;

  visit(node) {
    this[node.type](node);
  }

  // Frame helpers
  private getCurrentFrame() {
    return this.frameStack[this.frameStack.length - 1];
  }

  private popFrame() {
    return this.frameStack.pop();
  }

  private pushFrame() {
    let frame = new Frame();
    this.frameStack.push(frame);
    return frame;
  }

  Program(program) {
    this.programDepth++;

    let parentFrame = this.getCurrentFrame();
    let programFrame = this.pushFrame();

    let startType, endType;

    if (this.programDepth === 0) {
      startType = 'startProgram';
      endType = 'endProgram';
    } else {
      startType = 'startBlock';
      endType = 'endBlock';
    }

    programFrame.parentNode = program;
    programFrame.children = program.body;
    programFrame.childCount = program.body.length;
    programFrame.blankChildTextNodes = [];
    programFrame.actions.push([endType, [program, this.programDepth]]);

    for (let i = program.body.length - 1; i >= 0; i--) {
      programFrame.childIndex = i;
      this.visit(program.body[i]);
    }

    programFrame.actions.push([startType, [
      program, programFrame.childTemplateCount,
      programFrame.blankChildTextNodes.reverse()
    ]]);
    this.popFrame();

    this.programDepth--;

    // Push the completed template into the global actions list
    if (parentFrame) { parentFrame.childTemplateCount++; }
    push.apply(this.actions, programFrame.actions.reverse());
  }

  ElementNode(element) {
    let parentFrame = this.getCurrentFrame();
    let elementFrame = this.pushFrame();

    elementFrame.parentNode = element;
    elementFrame.children = element.children;
    elementFrame.childCount = element.children.length;
    elementFrame.mustacheCount += element.modifiers.length;
    elementFrame.blankChildTextNodes = [];

    let actionArgs = [
      element,
      parentFrame.childIndex,
      parentFrame.childCount
    ];

    elementFrame.actions.push(['closeElement', actionArgs]);

    for (let i = element.attributes.length - 1; i >= 0; i--) {
      this.visit(element.attributes[i]);
    }

    for (let i = element.children.length - 1; i >= 0; i--) {
      elementFrame.childIndex = i;
      this.visit(element.children[i]);
    }

    elementFrame.actions.push(['openElement', actionArgs.concat([
      elementFrame.mustacheCount, elementFrame.blankChildTextNodes.reverse() ])]);
    this.popFrame();

    // Propagate the element's frame state to the parent frame
    if (elementFrame.mustacheCount > 0) { parentFrame.mustacheCount++; }
    parentFrame.childTemplateCount += elementFrame.childTemplateCount;
    push.apply(parentFrame.actions, elementFrame.actions);
  }

  AttrNode(attr) {
    if (attr.value.type !== 'TextNode') {
      this.getCurrentFrame().mustacheCount++;
    }
  }

  TextNode(text) {
    let frame = this.getCurrentFrame();
    if (text.chars === '') {
      frame.blankChildTextNodes.push(domIndexOf(frame.children, text));
    }
    frame.actions.push(['text', [text, frame.childIndex, frame.childCount]]);
  }

  BlockStatement(node) {
    let frame = this.getCurrentFrame();

    frame.mustacheCount++;
    frame.actions.push(['block', [node, frame.childIndex, frame.childCount]]);

    if (node.inverse) { this.visit(node.inverse); }
    if (node.program) { this.visit(node.program); }
  }

  PartialStatement(node) {
    let frame = this.getCurrentFrame();
    frame.mustacheCount++;
    frame.actions.push(['mustache', [node, frame.childIndex, frame.childCount]]);
  }

  CommentStatement(text) {
    let frame = this.getCurrentFrame();
    frame.actions.push(['comment', [text, frame.childIndex, frame.childCount]]);
  }

  MustacheStatement(mustache) {
    let frame = this.getCurrentFrame();
    frame.mustacheCount++;
    frame.actions.push(['mustache', [mustache, frame.childIndex, frame.childCount]]);
  }
}

// Returns the index of `domNode` in the `nodes` array, skipping
// over any nodes which do not represent DOM nodes.
function domIndexOf(nodes, domNode) {
  let index = -1;

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];

    if (node.type !== 'TextNode' && node.type !== 'ElementNode') {
      continue;
    } else {
      index++;
    }

    if (node === domNode) {
      return index;
    }
  }

  return -1;
}
