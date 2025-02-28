import { localAssert } from '@glimmer/debug-util';
import { highlightedError, loc, quoteReportable, src, Validation } from '@glimmer/syntax';

interface ContentMatch {
  start: number;
  end: number;
  label?: string;
}

export class CreateSnippet {
  #code = '';
  #fullStart: number | undefined;
  #fullEnd: number | undefined;
  #prefix: ContentMatch | undefined;
  #main: ContentMatch | undefined;
  #suffix: ContentMatch | undefined;

  add(string: string) {
    this.#code += string;
    return this;
  }

  start() {
    this.#fullStart = this.#code.length;
    return this;
  }

  end() {
    this.#fullEnd = this.#code.length;
    return this;
  }

  #add(string: string) {
    const span = { start: this.#code.length, end: this.#code.length + string.length };
    this.#code += string;
    return span;
  }

  prefix(string: string) {
    this.#prefix = this.#add(string);
    return this;
  }

  main(string: string) {
    this.#main = this.#add(string);
    return this;
  }

  suffix(string: string) {
    this.#suffix = this.#add(string);
    return this;
  }

  done(
    moduleName: string,
    labels?: { primary?: string; extended?: string }
  ): Validation.HighlightedCode {
    localAssert(this.#main, 'main must be set');

    const source = new src.Source(this.#code, moduleName);
    const full = source.offsetSpan({
      start: this.#fullStart ?? 0,
      end: this.#fullEnd ?? this.#code.length,
    });
    const main = source.offsetSpan(this.#main);
    const expanded = expandedSpan(source, main, { pre: this.#prefix, post: this.#suffix });
    return Validation.HighlightedCode.from(
      { loc: full },
      {
        full: (expanded ?? main).fullLines(),
        primary: { loc: main, label: labels?.primary },
        expanded: expanded ? { loc: expanded, label: labels?.extended } : undefined,
      }
    );
  }
}

/**
 * Highlighted code is fundamentally:
 *
 * - A span for the "full" context that the highlight is contained within
 * - A highlighted span of code:
 *   - The primary span, with optional label
 *   - An optional expanded span (which the primary span must be contained within) with optional
 *     label
 *
 * This function is meant to be used in tests, and provides a microsyntax for creating highlights.
 *
 * For example, for this error message:
 *
 * ```
 * SyntaxError: Unclosed element `div`
 *
 * 2 | <div class="my-div"
 *   |  ━┳━
 *   |   ┗━ unclosed tag
 * ```
 *
 * You would pass in this syntax:
 *
 * ```
 * <[%main%]div[/main%] class="my-div"
 * ```
 *
 * And for this error message:
 *
 * ```
 * SyntaxError: Attempted to append `component.foo`, but `component` was not in scope
 *
 * 1 | {{component.foo}}
 *   |   ━┳━━━━━━━─┬──
 *   |    ┃        └── value
 *   |    ┗━━━━━━━━━━━ not in scope
 * ```
 *
 * You would pass in this syntax:
 *
 * ```
 * {{[%main%]component[/main%][%post%].foo[/post%]}}
 * ```
 *
 * And for this error message:
 *
 * ```
 * SyntaxError: Attempted to append `component.foo`, but `component` was not in scope
 *
 * 1 | {{component.foo}}
 *   |   ━┳━━━━━━━─┬──
 *   |    ┃        └── value
 *   |    ┗━━━━━━━━━━━ not in scope
 * ```
 *
 * You would pass in this syntax:
 *
 * ```
 * {{[%main%]component[/main%][%post%].foo[/post%]}}
 * ```
 *
 * And for this span:
 *
 * ```
 * 1 | <p>hello</p>
 *   | ─┳─
 *   |  ┗━━━━ invalid tag
 * ```
 *
 * You would pass in this syntax:
 *
 * ```
 * <[%pre%]<[/pre%][%main%]p[/main%][%post%]>[/%post%]hello</p>
 * ```
 */
export function highlightCode(
  code: string,
  options: SyntaxErrorOptions
): Validation.HighlightedCode {
  const spans: {
    pre?: ContentMatch;
    post?: ContentMatch;
    main?: ContentMatch;
  } = {};

  let processedCode = code;
  let offset = 0;

  const inlineTagRegex = /\[%(?<tag>[^%]+)%\](?<content>.*)\[\/\k<tag>%\]/gu;
  const fullTagRegex = /%%(?<content>.*)%%/su;

  let fullStart = 0;
  let fullEnd = code.length;

  let fullTagMatch = fullTagRegex.exec(code);

  if (fullTagMatch) {
    const content = (fullTagMatch.groups as { content: string }).content;

    fullStart = fullTagMatch.index;
    fullEnd = fullTagMatch.index + content.length;

    offset = fullStart + 1;

    processedCode =
      processedCode.substring(0, fullStart) + content + processedCode.substring(fullEnd);
  }

  let match: RegExpExecArray | null;

  while ((match = inlineTagRegex.exec(code)) !== null) {
    const [fullMatch] = match;
    const { tag: tagName, content } = match.groups as { tag: string; content: string };

    localAssert(
      tagName === 'pre' || tagName === 'post' || tagName === 'main',
      `Invalid tag in highlightCode test utility: ${tagName}`
    );

    // Add a span for this tag
    spans[tagName] = {
      start: match.index - offset,
      end: match.index - offset + content.length,
    };

    fullEnd -= 4;

    // Replace the tag with just its content in the processed code
    processedCode =
      processedCode.substring(0, match.index - offset) +
      content +
      processedCode.substring(match.index - offset + fullMatch.length);

    // Track how much we've shortened the string
    offset += fullMatch.length - content.length;

    // Reset regex to continue search
    inlineTagRegex.lastIndex = match.index + content.length;
  }

  localAssert(spans.main, 'No main tag in highlightCode test utility');

  const source = new src.Source(processedCode, options.moduleName);
  const primary = source.offsetSpan(spans.main);
  const expanded = expandedSpan(source, primary, spans);
  const highlighted = Validation.HighlightedCode.from(
    { loc: source.offsetSpan({ start: fullStart, end: fullEnd }) },
    {
      full: (expanded ?? primary).fullLines(),
      primary: { loc: primary, label: options.primary },
      expanded: expanded ? { loc: expanded, label: options.extended } : undefined,
    }
  );

  return highlighted;
}

function expandedSpan(
  source: src.Source,
  main: src.SourceSpan,
  { pre, post }: { pre?: ContentMatch | undefined; post?: ContentMatch | undefined }
): src.SourceSpan | undefined {
  if (pre && post) {
    return source.offsetSpan(pre).extend(source.offsetSpan(post));
  } else if (pre) {
    return source.offsetSpan(pre).extend(main);
  } else if (post) {
    return main.extend(source.offsetSpan(post));
  }
}

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

interface SyntaxErrorOptions {
  moduleName: string;
  primary?: string;
  extended?: string;
}

export function syntaxErrorFor2(
  message: string,
  code: string,
  options: { moduleName: string; primary?: string; extended?: string }
): Error {
  const highlighted = highlightCode(code, options);
  return highlightedError(highlighted, { error: message });
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
    resolved: (name: Validation.NameNode) => Validation.VariableReferenceContext;
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

  return quoteReportable(ctx.addNotes(...(options?.notes ?? [])));
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
