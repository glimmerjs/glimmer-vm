import {
  highlightError,
  jitSuite,
  preprocess,
  RenderTest,
  test,
} from '@glimmer-workspace/integration-tests';

class CompileErrorTests extends RenderTest {
  static suiteName = 'compile errors';

  @test
  'A helpful error message is provided for unclosed elements'() {
    this.assert.throws(
      () => {
        preprocess('\n<div class="my-div"\n foo={{bar}}>\n<span>\n</span>\n', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Unclosed element `div`')`
        2 | <div class="my-div"
          |  ===
          |   \==== unclosed tag
      `
    );

    this.assert.throws(
      () => {
        preprocess('\n<div class="my-div">\n<span>\n', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Unclosed element `span`')`
        3 | <span>
          |  ====
          |   \==== unclosed tag
      `
    );
  }

  @test
  'A helpful error message is provided for unmatched end tags'() {
    this.assert.throws(
      () => {
        preprocess('</p>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Closing tag </p> without an open tag')`
        1 | </p>
          | ====
          |  \==== closing tag
      `
    );

    this.assert.throws(
      () => {
        preprocess('<em>{{ foo }}</em> \n {{ bar }}\n</div>', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Closing tag </div> without an open tag')`
        3 | </div>
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'A helpful error message is provided for end tags for void elements'() {
    this.assert.throws(
      () => {
        preprocess('<input></input>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('<input> elements do not need end tags. You should remove it')`
        1 | <input></input>
          |        ========
          |         \==== void element
      `
    );

    this.assert.throws(
      () => {
        preprocess('<div>\n  <input></input>\n</div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('<input> elements do not need end tags. You should remove it')`
        2 |   <input></input>
          |          ========
          |           \==== void element
      `
    );

    this.assert.throws(
      () => {
        preprocess('\n\n</br>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('<br> elements do not need end tags. You should remove it')`
        3 | </br>
          | =====
          |  \==== void element
      `
    );
  }

  @test
  'A helpful error message is provided for end tags with attributes'() {
    this.assert.throws(
      () => {
        preprocess('<div>\nSomething\n\n</div foo="bar">', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Invalid end tag: closing tag must not have attributes')`
        4 | </div foo="bar">
          |       =========
          |          \==== invalid attribute
      `
    );
  }

  @test
  'A helpful error message is provided for mismatched start/end tags'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\nSomething\n\n</div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        5 | </div>
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'error line numbers include comment lines'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\n{{! some comment}}\n\n</div>', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        5 | </div>
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'error line numbers include mustache only lines'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\n{{someProp}}\n\n</div>', { meta: { moduleName: 'test-module' } });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        5 | </div>
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'error line numbers include block lines'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\n{{#some-comment}}\n{{/some-comment}}\n</div>', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        5 | </div>
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'error line numbers include whitespace control mustaches'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\n{{someProp~}}\n\n</div>{{some-comment}}', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        5 | </div>{{some-comment}}
          | ======
          |  \==== closing tag
      `
    );
  }

  @test
  'error line numbers include multiple mustache lines'() {
    this.assert.throws(
      () => {
        preprocess('<div>\n<p>\n{{some-comment}}</div>{{some-comment}}', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError('Closing tag </div> did not match last open tag <p> (on line 2)')`
        3 | {{some-comment}}</div>{{some-comment}}
          |                 ======
          |                   \==== closing tag
      `
    );
  }

  @test
  'Unquoted attribute with expression throws an exception'() {
    this.assert.throws(
      () => preprocess('<img class=foo{{bar}}>', { meta: { moduleName: 'test-module' } }),
      highlightError(`Invalid dynamic value in an unquoted attribute`)`
        1 | <img class=foo{{bar}}>
          |            ---=======
          |                 \==== invalid dynamic value
          |              \------- missing quotes
      `
    );
    this.assert.throws(
      () => preprocess('<img class={{foo}}{{bar}}>', { meta: { moduleName: 'test-module' } }),
      highlightError(`Invalid dynamic value in an unquoted attribute`)`
        1 | <img class={{foo}}{{bar}}>
          |            =======-------
          |                 \---- missing quotes
          |              \======= invalid dynamic value
      `
    );
    this.assert.throws(
      () => preprocess('<img \nclass={{foo}}bar>', { meta: { moduleName: 'test-module' } }),
      highlightError('Invalid dynamic value in an unquoted attribute')`
        2 | class={{foo}}bar>
          |       =======---
          |               \--- missing quotes
          |          \======== invalid dynamic value
      `
    );
    this.assert.throws(
      () =>
        preprocess('<div \nclass\n=\n{{foo}}&amp;bar ></div>', {
          meta: { moduleName: 'test-module' },
        }),
      highlightError('Invalid dynamic value in an unquoted attribute')`
        4 | {{foo}}&amp;bar ></div>
          | =======--------
          |           \---- missing quotes
          |   \======== invalid dynamic value
      `
    );
  }
}

jitSuite(CompileErrorTests);
