const PROCESSED = new WeakSet();

const observer = new MutationObserver((records) => {
  const nodes: NodeListOf<HTMLTableSectionElement> = document.querySelectorAll(
    'li.fail tbody:not(.processed)'
  );

  for (const node of nodes) {
    node.classList.add('processed');

    cleanup(node);
  }
});

observer.observe(document, { childList: true, subtree: true });

function cleanup(node: HTMLTableSectionElement) {
  const pres = node.querySelectorAll(':is(.test-expected, .test-actual) pre');

  for (const pre of pres) {
    const text = pre.innerHTML;

    if (text.startsWith('"') && text.endsWith('"')) {
      pre.innerHTML = text.slice(1, -1).replaceAll('\\"', '"');
    }
  }

  const diff: HTMLPreElement | null = node.querySelector('.test-diff pre');

  if (diff) {
    const first = diff.firstChild;
    const last = diff.lastChild;

    if (first && last && first.textContent?.startsWith('"') && last.textContent?.endsWith('"')) {
      first.textContent = first.textContent.slice(1, -1);
      last.textContent = last.textContent.slice(1, -1);

      diff.innerHTML = diff.innerHTML.replaceAll('\\"', '"');
    }
  }
}
