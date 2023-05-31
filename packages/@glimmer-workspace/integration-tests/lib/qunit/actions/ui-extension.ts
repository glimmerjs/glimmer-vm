import { enumerate, unwrap } from '@glimmer/util';
import { Action, ActionData, DiffEntry, frag } from './steps';

export function installUiExtensions(qunit: QUnit) {
  qunit.begin(() => {
    let observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        let target = mutation.target;

        if (!isElement(target)) continue;

        if (target.matches(':has(ol > li)')) {
          let nodes = target.querySelectorAll('ol.qunit-assert-list > li');

          for (let node of nodes) {
            if (node.classList.contains('qunit-extended')) continue;
            node.classList.add('qunit-extended');

            normalizeTag(node, 'action');
            normalizeTag(node, 'step');

            for (let sourceNode of node.querySelectorAll(':scope tr.test-source')) {
              let header = sourceNode.querySelector(':scope th') as HTMLTableCellElement;
              let body = sourceNode.querySelector(':scope td') as HTMLTableCellElement;

              if (body.classList.contains('source-cell')) continue;
              body.classList.add('source-cell');

              let details = document.createElement('details');
              let summary = document.createElement('summary');
              summary.innerHTML = 'Source';

              details.append(summary);
              details.append(linkify(body.textContent ?? '', details));
              body.replaceChildren(details);

              header.replaceChildren('');
            }

            if (node.innerHTML.includes('[verify] ')) {
              let expectedRow = node.querySelector(':scope tr.test-expected') as
                | HTMLTableRowElement
                | undefined;
              let actualRow = node.querySelector(':scope tr.test-actual') as
                | HTMLTableRowElement
                | undefined;
              let diffRow = node.querySelector(':scope tr.test-diff') as
                | HTMLTableRowElement
                | undefined;

              if (expectedRow && actualRow && diffRow) {
                let expectedActions = convertSteps(expectedRow, 'expected');
                let actualActions = convertSteps(actualRow, 'actual');

                let diff = diffSteps(expectedActions, actualActions);
                convertDiff(diffRow, diff);
                expectedRow.after(diffRow);
                actualRow.after(expectedRow);
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

function isInternal(line: string) {
  return (
    line.includes('node_modules/qunit') || line.includes('@glimmer-workspace/integration-tests/lib')
  );
}

function convertSteps(element: HTMLTableRowElement, kind: string) {
  let td = element.querySelector(':scope td') as HTMLTableCellElement;
  td.classList.add(kind, 'token-list');
  let steps = td.querySelector(':scope pre') as HTMLPreElement;
  let actions = JSON.parse(steps.textContent!) as QUnit.ActionData[];

  if (actions.length === 0) {
    steps.replaceWith(Action.empty());
    return [];
  } else {
    steps.replaceWith(...actions.map((action) => Action.toFragment(action)));
    return actions.map((action) => Action.from(action));
  }
}

function convertDiff(element: HTMLTableRowElement, diff: DiffEntry[]) {
  let td = element.querySelector(':scope td') as HTMLTableCellElement;
  td.classList.add('diff', 'token-list');
  let diffContainer = td.querySelector(':scope pre') as HTMLPreElement;
  diffContainer.replaceWith(
    ...diff.map((entry) => entry.toFragment()),
    frag`<button class='show-details' onclick='this.closest("table").classList.toggle("details-shown") ? this.innerText = "hide details" : this.innerText = "show details"'>show details</button>`
  );
}

function diffSteps(expected: QUnit.Action[], actual: QUnit.Action[]): DiffEntry[] {
  let diff: DiffEntry[] = [];

  for (let [i, expectedAction] of enumerate(expected)) {
    if (i >= actual.length) {
      diff.push(new DiffEntry('missing', expectedAction));
      continue;
    }

    let actualAction = actual[i] as QUnit.Action;

    if (expectedAction.matches(actualAction)) {
      diff.push(new DiffEntry('match', expectedAction));
    } else {
      diff.push(
        new DiffEntry('missing', expectedAction),
        new DiffEntry('unexpected', actualAction)
      );
    }
  }

  for (let extraAction of actual.slice(expected.length)) {
    diff.push(new DiffEntry('unexpected', extraAction));
  }

  return diff;
}

// convert lines like `at foo (http://some.local/foo.ts?foo=bar)` to
// `at foo (<button onclick='console.log('this.innerHTML')'>http://some.local/foo.ts?foo=bar</button>)`
function linkify(source: string, details: HTMLDetailsElement): DocumentFragment {
  let seenInternals = false;

  let fragments = source.split('\n').map((line) => {
    if (isInternal(line)) {
      let span = mapStackLine(line);
      span.classList.add('internals');

      if (!seenInternals) {
        seenInternals = true;
        span.classList.add('first-internals');
        span.innerHTML += '<span class="more-internals"> ...</span>';
        let button = document.createElement('button');
        button.classList.add('show-internals');
        button.innerHTML = '<span>show</span> test internals';
        let showHideSpan = button.firstElementChild as HTMLSpanElement;
        button.addEventListener('click', () => {
          showHideSpan.innerHTML = details.classList.toggle('internals-shown') ? 'hide' : 'show';
        });
        span.append(button);
      }

      return span;
    } else {
      return mapStackLine(line);
    }
  });

  let template = document.createElement('template');
  template.content.append(...fragments);
  return template.content;
}

function mapStackLine(line: string) {
  let output =
    `<span>` +
    line
      .trim()
      .replaceAll(/[<>]/gu, (char) => (char === '<' ? '&lt;' : '&gt;'))
      .replaceAll(/(\w+:\/\/[^\s)]*)/gu, (_, url) => {
        let urlObject = new URL(url);
        return `<button type='button' class='log-link' onclick='console.log(${JSON.stringify(
          url
        )})'><span>${urlObject.pathname.split('/').at(-1)}</span></button>`;
      }) +
    `</span>`;

  let template = document.createElement('template');
  template.innerHTML = output;

  return template.content.lastChild as HTMLSpanElement;
}

function normalizeTag(element: Element, what: 'action' | 'step'): void {
  let stringTag = `[[${what}]]`;

  if (element.textContent?.includes(stringTag)) {
    let messageElement = element.querySelector(':scope span.test-message') as HTMLSpanElement;
    let rawData = messageElement.textContent?.slice(stringTag.length + 1);
    let data = ActionData.from(JSON.parse(unwrap(rawData)), what);
    element.classList.add(what, 'marker');

    messageElement.replaceWith(
      frag`<span class="${what} tag">${what}</span><span class="${what} marker">${ActionData.toFragment(
        data,
        what
      )}</span>`
    );
  }
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}
