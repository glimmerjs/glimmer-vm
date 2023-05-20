export function strip(strings: TemplateStringsArray, ...dynamic: string[]) {
  return strings
    .map((text: string, index: number) => {
      return `${text
        .split('\n')
        .map((s) => s.trim())
        .join('')}${dynamic[index] ?? ''}`;
    })
    .join('');
}

export function stripTight(strings: TemplateStringsArray) {
  let [first] = strings;
  if (!first) return '';

  return first
    .split('\n')
    .map((s) => s.trim())
    .join('');
}

export function trimLines(strings: TemplateStringsArray) {
  let [first] = strings;
  if (!first) return '';

  return first
    .trim()
    .split('\n')
    .map((s) => s.trim())
    .join('\n');
}
