import { DOMHelper } from "htmlbars-runtime";

let dom;

QUnit.module('DOM Helper (Node)', {
  afterEach: function() {
    dom = null;
  }
});

if (typeof document === 'undefined') {
  test('it throws when instantiated without document', function(){
    let throws = false;
    try {
      dom = new DOMHelper();
    } catch (e) {
      throws = true;
    }
    ok(throws, 'dom helper cannot instantiate');
  });
}

test('it instantiates with a stub document', function(){
  let called = false;
  let element = {};
  let doc = {
    createElement: function(){
      called = true;
      return element;
    }
  };
  dom = new DOMHelper(doc);
  ok(dom, 'dom helper can instantiate');
  let createdElement = dom.createElement('div');
  equal(createdElement, element, 'dom helper calls passed stub');
});
