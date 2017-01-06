let visitors = {
  Program: function(walker, node, callback) {
    for (let i = 0; i < node.body.length; i++) {
      walker.visit(node.body[i], callback);
    }
  },

  ElementNode: function(walker, node, callback) {
    for (let i = 0; i < node.children.length; i++) {
      walker.visit(node.children[i], callback);
    }
  },

  BlockStatement: function(walker, node, callback) {
    walker.visit(node.program, callback);
    walker.visit(node.inverse, callback);
  }
};

export default class Walker {
  constructor(order = undefined) {
    this.order = order;
    this.stack = [];
  }

  visit(node, callback) {
    if (!node) {
      return;
    }

    this.stack.push(node);

    if (this.order === 'post') {
      this.children(node, callback);
      callback(node, this);
    } else {
      callback(node, this);
      this.children(node, callback);
    }

    this.stack.pop();
  }

  children(node, callback) {
    let visitor = visitors[node.type];
    if (visitor) {
      visitor(this, node, callback);
    }
  }
}
