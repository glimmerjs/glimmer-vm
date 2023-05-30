export function installUiExtensions(qunit: QUnit) {
  qunit.begin(() => {
    let observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        let target = mutation.target;

        if (!isElement(target)) continue;

        if (target.matches(':has(ol > li)')) {
          let nodes = target.querySelectorAll('ol.qunit-assert-list > li');

          for (let node of nodes) {
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
              node.classList.add('verify-steps');

              normalizeText(node.querySelector('.test-message')!, 'verify');

              for (let preNode of node.querySelectorAll(
                ':scope :is(tr.test-expected, tr.test-actual) pre'
              )) {
                preNode.outerHTML = (JSON.parse(preNode.textContent!) as string[])
                  .map((step) => {
                    return replaceStep(step);
                  })
                  .join('');
              }

              for (let headerNode of node.querySelectorAll(':scope tr.test-diff > th')) {
                headerNode.innerHTML = `<span>Delta</span>`;
              }

              let order: ('insertion' | 'deletion' | 'same')[] = [];

              for (let preNode of node.querySelectorAll(':scope :is(tr.test-diff) pre')) {
                let nodes: ChildNode[] = [];

                for (let node of preNode.children) {
                  if (node.tagName === 'INS') {
                    order.push('insertion');
                  } else if (node.tagName === 'DEL') {
                    order.push('deletion');
                  } else if (node.textContent?.includes('[step:')) {
                    order.push('same');
                  }

                  node.innerHTML =
                    node.tagName === 'INS' || node.tagName === 'DEL'
                      ? replaceStep(node.textContent ?? '')
                      : replaceStep(
                          (node.textContent ?? '')
                            .replaceAll(/^\s*\[/gu, '')
                            .replaceAll(/\]\s*$/gu, '')
                        );
                  nodes.push(node);
                }

                preNode.replaceChildren(...nodes);
              }

              if (order.some((step) => step !== 'same')) {
                let legend = document.createElement('div');
                legend.classList.add('legend');
                let html = '';

                let seen = {
                  insertion: false,
                  deletion: false,
                  same: false,
                };

                for (let operation of order) {
                  if (seen[operation]) {
                    continue;
                  }

                  seen[operation] = true;

                  switch (operation) {
                    case 'insertion':
                      html += `<span class="expected-step ins">actual (unexpected)</span>`;
                      break;
                    case 'deletion':
                      html += `<span class="expected-step del">expected (missing)</span>`;
                      break;
                    case 'same':
                      html += `<span class="expected-step same">expected and actual</span>`;
                      break;
                  }
                }

                legend.innerHTML = html;

                let row = document.createElement('tr');
                let header = document.createElement('th');
                header.textContent = 'Legend';
                let diffRow = node.querySelector(':scope tr.test-diff')!;
                diffRow.parentElement?.insertBefore(row, diffRow.nextSibling);
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

// convert lines like `at foo (http://some.local/foo.ts?foo=bar)` to
// `at foo (<button onclick='console.log('this.innerHTML')'>http://some.local/foo.ts?foo=bar</button>)`
function linkify(source: string, details: HTMLDetailsElement): DocumentFragment {
  let seenInternals = false;

  let fragments = source.split('\n').map((line) => {
    if (line.includes('node_modules/qunit')) {
      let span = mapStackLine(line);
      span.classList.add('internals');

      if (!seenInternals) {
        seenInternals = true;
        span.classList.add('first-internals');
        span.innerHTML += '<span class="more-internals"> ...</span>';
        let button = document.createElement('button');
        button.classList.add('show-internals');
        button.innerHTML = '<span>show</span> qunit internals';
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

  // debugger;
  let template = document.createElement('template');
  template.innerHTML = output;

  if (template.content.lastChild?.tagName === 'SPAN') {
    return template.content.lastChild as HTMLSpanElement;
  } else {
    console.groupCollapsed(`⚠️ Bug in test harness: couldn't extract URL`);
    console.warn('line', line);
    console.warn('element', template.innerHTML);
    console.groupEnd();
    let output = `<span>${line}</span>`;
    template.innerHTML = output;
    return template.content.firstChild as HTMLSpanElement;
  }
}

function replaceStep(input: string): string {
  return input.replaceAll(
    /\s*(?:[,[]\s*)?(?:["']\s*)?\[step: (.*?)\]\s*(?:["']\s*)?/gu,
    `<span class="expected-step">$1</span>`
  );
}

function normalizeTag(element: Element, what: 'action' | 'step'): void {
  let stringTag = `[${what}]`;

  if (element.textContent?.includes(stringTag)) {
    element.classList.add(what, 'marker');
    let result = element.innerHTML
      .replaceAll(stringTag, `<span class="${what} marker">action</span>`)
      .replaceAll(/\[(.*?)\]/gu, `<span class="${what} tag">$1</span>`);

    element.innerHTML = result;
  }
}

function normalizeText(element: Element, tag: string): void {
  let stringTag = `[${tag}]`;

  if (element.textContent?.includes(stringTag)) {
    let result = element.innerHTML.replaceAll(stringTag, `<span class="verify">${tag}</span>`);

    element.innerHTML = result;
  }
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}
