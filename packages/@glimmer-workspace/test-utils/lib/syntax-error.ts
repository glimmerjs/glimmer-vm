import type { Validation } from '@glimmer/syntax';
import { loc, src, unresolvedBindingError } from '@glimmer/syntax';

/**
 * If specifying context, it should be represented as: `{{<|code|>}}`, where the full string is the
 * context, and `code` is the code inside the context.
 */
export function syntaxErrorFor(
  message: string,
  code: string,
  moduleName: string,
  line: number,
  column: number
): Error {
  const extracted = extractSyntaxCode(code);
  const quotedCode = formatCode(extracted);
  const extractedColumn = extracted.inner ? column + extracted.inner.start : column;

  let error = new Error(
    `${message}: ${quotedCode}(error occurred in '${moduleName}' @ line ${line} : column ${extractedColumn})`
  );

  error.name = 'SyntaxError';

  return error;
}

export function extractSyntaxCode(code: string): {
  context: string;
  inner?: { start: number; end: number };
} {
  const start = code.indexOf('<|');
  const end = code.indexOf('|>');

  if (start !== -1 && end !== -1) {
    const prefix = code.slice(0, start);
    const suffix = code.slice(end + 2);
    const inner = code.slice(start + 2, end);

    return { context: `${prefix}${inner}${suffix}`, inner: { start, end } };
  } else {
    return { context: code };
  }
}

function formatCode({
  context,
  inner,
}: {
  context: string;
  inner?: { start: number; end: number };
}) {
  if (inner) {
    return `\n\n|\n|  ${context}\n|  ${' '.repeat(inner.start)}${'^'.repeat(inner.end - inner.start - 2)}\n\n`;
  } else {
    return context ? `\n\n|\n|  ${context.split('\n').join('\n|  ')}\n|\n\n` : '';
  }
}

/**
 * If specifying context, it should be represented as: `{{<|code|>}}`, where the full string is the
 * context, and `code` is the code inside the context.
 */
export function unresolvedErrorFor(
  path: (
    outer: src.SourceSpan,
    content: src.SourceSpan
  ) => {
    resolved: (name: Validation.NameNode) => Validation.VariableReferenceValidationContext;
  },
  code: string,
  moduleName: string,
  options?: { notes?: string[] }
): Error {
  const extracted = extractCode(code);

  const source = new src.Source(extracted.full, moduleName);
  const outerSpan = src.SourceSpan.forCharPositions(
    source,
    extracted.outer.start,
    extracted.outer.end
  );
  const headSpan = src.SourceSpan.forCharPositions(
    source,
    extracted.inner.start,
    extracted.inner.end
  );

  const name = { type: 'tag', name: headSpan.asString(), loc: loc(headSpan) };
  const ctx = path(
    outerSpan,
    src.SourceSpan.forCharPositions(source, 0, extracted.full.length)
  ).resolved(name);

  return unresolvedBindingError({
    context: ctx,
    notes: options?.notes,
  });
}

function extractCode(source: string) {
  const ctxStart = source.indexOf('[%');
  const ctxEnd = source.indexOf('%]');
  const innerStart = source.indexOf('<|');
  const innerEnd = source.indexOf('|>');

  const hasOuter = ctxStart !== -1 && ctxEnd !== -1;
  const hasInner = innerStart !== -1 && innerEnd !== -1;

  if (hasOuter && hasInner) {
    const rawPrefix = source.slice(0, innerStart);
    const rawSuffix = source.slice(innerEnd + 2);
    const inner = source.slice(innerStart + 2, innerEnd);

    const [outerPrefix, innerPrefix] = rawPrefix.split('[%');
    const [innerSuffix, outerSuffix] = rawSuffix.split('%]');

    const full = `${outerPrefix}${innerPrefix}${inner}${innerSuffix}${outerSuffix}`;

    return {
      full,
      code: { start: 0, end: full.length },
      inner: { start: innerStart - 2, end: innerEnd - 4 },
      outer: { start: ctxStart, end: ctxEnd - 6 },
    };
  } else if (hasInner) {
    const prefix = source.slice(0, innerStart);
    const suffix = source.slice(innerEnd + 2);
    const inner = source.slice(innerStart + 2, innerEnd);
    const full = `${prefix}${inner}${suffix}`;

    return {
      full,
      code: { start: 0, end: full.length },
      inner: { start: innerStart, end: innerEnd - 2 },
      outer: { start: 0, end: full.length },
    };
  } else {
    const full = source;
    return {
      full,
      code: { start: 0, end: full.length },
      outer: { start: 0, end: full.length },
      inner: { start: 0, end: full.length },
    };
  }
}
