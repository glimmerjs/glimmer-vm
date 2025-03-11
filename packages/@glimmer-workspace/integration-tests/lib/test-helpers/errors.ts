import type { Optional } from '@glimmer/interfaces';
import type { PrecompileOptionsWithLexicalScope } from '@glimmer/syntax';
import { precompile } from '@glimmer/compiler';
import { localAssert } from '@glimmer/debug-util';
import {
  GlimmerSyntaxError,
  highlightCode,
  normalize,
  src,
  Validation,
  verifyTemplate,
} from '@glimmer/syntax';

export function highlight(strings: TemplateStringsArray, ...args: string[]) {
  return highlightCode(
    highlightParts(highlightToParts(strings, ...args), { moduleName: 'test-module' })
  );
}

type VerifyingErrorArgs = [template: string, message: string, options?: VerifyOptions];
type VerifyingValidArgs = [template: string, options?: VerifyOptions];

export function verifying(...args: VerifyingValidArgs): { isValid: () => void };
export function verifying(...args: VerifyingErrorArgs): {
  throws: (raw: TemplateStringsArray, ...args: string[]) => { errors: () => void };
};
export function verifying(...args: VerifyingValidArgs | VerifyingErrorArgs) {
  if (args.length === 1 || typeof args[1] !== 'string') {
    const [template, options] = args as VerifyingValidArgs;
    QUnit.config.current.assert.ok(true, `🔽 verifying ${template}, expecting 🟢`);
    return { isValid: () => verify(template, { expect: 'valid', ...options }) };
  }

  const [template, message, options] = args;

  const throws = (raw: TemplateStringsArray, ...args: string[]) => {
    QUnit.config.current.assert.ok(true, `🔽 verifying ${template}, expecting 🔴`);

    const error = highlightError(message)(raw, ...args);

    return {
      errors: () => {
        verify(template, { expect: 'error', error, ...options });
      },
    };
  };

  return { throws };
}

type VerifyOptions = {
  strict?: boolean | 'both';
  using?: 'parser' | 'compiler' | 'both';
  lexicalScope?: (name: string) => boolean;
};

function getOptions(options?: VerifyOptions): PrecompileOptionsWithLexicalScope[] {
  const lexicalScope = options?.lexicalScope ?? (() => false);
  const meta = { moduleName: 'test-module' };
  const strict = options?.strict ?? 'both';
  if (strict === 'both') {
    return [
      { strictMode: true, lexicalScope, meta },
      { strictMode: false, lexicalScope, meta },
    ];
  } else {
    return [
      {
        strictMode: strict,
        lexicalScope,
        meta,
      },
    ];
  }
}

type ParseResult =
  | {
      status: 'error';
      error: GlimmerSyntaxError;
      extra: GlimmerSyntaxError[];
    }
  | {
      status: 'failed';
      error: unknown;
    }
  | {
      status: 'valid';
    };

function verifyCompile(source: string, options: PrecompileOptionsWithLexicalScope): ParseResult {
  try {
    precompile(source, options);
    return { status: 'valid' };
  } catch (e) {
    if (typeof e === 'object' && e && e instanceof GlimmerSyntaxError) {
      return { status: 'error', error: e, extra: [] };
    }

    QUnit.assert.throws(
      () => {
        throw e;
      },
      GlimmerSyntaxError,
      `expected a forgiving parse, got an error`
    );
    return { status: 'failed', error: e };
  }
}

function verifyParse(template: string, options: PrecompileOptionsWithLexicalScope): ParseResult {
  const source = new src.Source(template, 'test-module');

  try {
    const [ast] = normalize(source, options);
    const errors = verifyTemplate(ast, options);

    const [first, ...extra] = errors;

    if (!first) {
      return { status: 'valid' };
    }

    return { status: 'error', error: first.error(), extra: extra.map((e) => e.error()) };
  } catch (e) {
    return { status: 'failed', error: e };
  }
}

function verify(
  template: string,
  options: VerifyOptions & ({ expect: 'valid' } | { expect: 'error'; error: GlimmerSyntaxError })
) {
  const precompileOptionList = getOptions(options);

  const using: ('compiler' | 'parser')[] =
    options.using === 'both' || options.using === undefined
      ? ['compiler', 'parser']
      : [options.using];

  for (const precompileOptions of precompileOptionList) {
    for (const mode of using) {
      QUnit.assert.ok(
        true,
        `🔎 verifying \`${precompileOptions.strictMode ? 'strict' : 'non-strict'}\` using \`${mode}\``
      );
      const result =
        mode === 'compiler'
          ? verifyCompile(template, precompileOptions)
          : verifyParse(template, precompileOptions);

      if (result.status === 'failed') {
        // failure is already reported
        return;
      }

      if (options.expect === 'valid') {
        if (result.status === 'valid') {
          pushSuccess(`expected 🟢 no errors`);
          return;
        } else {
          QUnit.assert.equal(
            '',
            [result.error.message, ...result.extra.map((e) => e.message)].join('\n\n'),
            `expected no errors, got ${result.extra.length + 1}`
          );
        }
        return;
      }

      // if we expect an error...

      const expectedError = options.error;

      if (result.status === 'valid') {
        pushFailure(`expected 🔴 syntax error, got 🟢 no errors`);
        return;
      }

      const { error, extra } = result;

      if (extra.length > 0) {
        QUnit.assert.equal(
          '',
          displayErrors(extra),
          `expected only one error, got ${extra.length} more`
        );
      }

      if (error) {
        QUnit.assert.equal(error.message, expectedError.message, `expected 🔴`);
      } else {
        pushFailure(`expected 🔴 syntax error, got 🟢 no errors`);
      }
    }
  }
}

function pushFailure(message: string) {
  QUnit.assert.pushResult({
    result: false,
    message,
  } as any);
}

function pushSuccess(message: string) {
  QUnit.assert.pushResult({
    result: true,
    message,
  } as any);
}

function displayErrors(errors: GlimmerSyntaxError[]) {
  return errors.map((e) => e.message).join('\n\n');
}

export function highlightError(error: string, notes?: string[]) {
  return (strings: TemplateStringsArray, ...args: string[]): GlimmerSyntaxError => {
    const highlighted = highlightParts(highlightToParts(strings, ...args), {
      moduleName: 'test-module',
    });
    return GlimmerSyntaxError.highlight(error, highlighted.addNotes(notes ?? []));
  };
}

export function assertParts(
  description: string,
  actualString: string,
  expected: Omit<HighlightParts, 'line'>
) {
  const actualParts = highlightToParts`${actualString}`;
  const expectedParts = { ...expected, line: `${expected.lineno}` };
  QUnit.assert.deepEqual(actualParts, expectedParts, `parts: ${description}`);
  QUnit.assert.equal(
    highlightCode(highlightParts(actualParts, { moduleName: 'test-module' })),
    highlightCode(highlightParts(expectedParts, { moduleName: 'test-module' })),
    `string: ${description}`
  );
}

export function spansForParts(
  parts: [before: string, prefix: string, primary: string, suffix: string]
): { primary: { start: number; end: number }; expanded: { start: number; end: number } };
export function spansForParts(
  parts: [before: string, prefix: `-[ ${string} ]`, primary: `=[ ${string} ]`]
): { primary: { start: number; end: number }; expanded: { start: number; end: number } };
export function spansForParts(
  parts: [before: string, primary: `=[ ${string} ]`, suffix: `-[ ${string} ]`]
): { primary: { start: number; end: number }; expanded: { start: number; end: number } };
export function spansForParts(parts: [before: string, primary: string]): {
  primary: { start: number; end: number };
};
export function spansForParts(
  parts:
    | [before: string, prefix: string, primary: string, suffix: string]
    | [before: string, prefix: `-[ ${string} ]`, primary: `=[ ${string} ]`]
    | [before: string, primary: `=[ ${string} ]`, suffix: `-[ ${string} ]`]
    | [before: string, primary: string]
) {
  if (parts.length === 4) {
    const [before, prefix, primary, suffix] = parts;
    return {
      primary: {
        start: before.length + prefix.length,
        end: before.length + prefix.length + primary.length,
      },
      expanded: {
        start: before.length,
        end: before.length + prefix.length + primary.length + suffix.length,
      },
    };
  } else if (parts.length === 3) {
    const [before, a, b] = parts;

    if (a.startsWith('=')) {
      const primary = a.slice(3, -2);
      const suffix = b.slice(3, -2);

      return {
        primary: {
          start: before.length,
          end: before.length + primary.length,
        },
        expanded: {
          start: before.length,
          end: before.length + primary.length + suffix.length,
        },
      };
    } else {
      const prefix = a.slice(3, -2);
      const primary = b.slice(3, -2);

      return {
        primary: {
          start: before.length + prefix.length,
          end: before.length + prefix.length + primary.length,
        },
        expanded: {
          start: before.length,
          end: before.length + prefix.length + primary.length,
        },
      };
    }
  } else {
    const [before, primary] = parts;
    return {
      primary: {
        start: before.length,
        end: before.length + primary.length,
      },
    };
  }
}

export const highlighted = (strings: TemplateStringsArray, ...args: string[]) => {
  const { lineno, content, primary, expanded } = highlightToParts(strings, ...args);
  const source = src.Source.from(content);

  return Validation.Highlight.fromInfo({
    full: source.lineSpan(lineno),
    primary: { loc: source.offsetSpan(primary.loc), label: primary.label },
    expanded: expanded && { loc: source.offsetSpan(expanded.loc), label: expanded.label },
  });
};

const highlightParts = (
  parts: HighlightParts,
  { moduleName }: { moduleName: string }
): Validation.Highlight => {
  const { content: full, lineno, primary, expanded } = padLines(parts);
  const source = src.Source.from(full, { meta: { moduleName } });

  return Validation.Highlight.fromInfo({
    full: source.lineSpan(lineno),
    primary: { loc: source.offsetSpan(primary.loc), label: primary.label },
    expanded: expanded && {
      loc: source.offsetSpan(expanded.loc),
      label: expanded.label,
    },
  });
};

function padLines({ primary, expanded, ...parts }: HighlightParts): HighlightParts {
  if (parts.line === '1') {
    return { content: parts.content, line: parts.content, lineno: 1, primary, expanded };
  } else {
    const line = parseInt(parts.line, 10);
    let padding = '';

    for (let i = 0; i < line - 1; i++) {
      padding += '\n';
    }

    return {
      content: `${padding}${parts.content}`,
      lineno: parts.lineno,
      line: parts.line,
      primary: {
        loc: padSpan(primary.loc, padding.length),
        label: primary.label,
      },
      expanded: expanded && {
        loc: padSpan(expanded.loc, padding.length),
        label: expanded.label,
      },
    };
  }
}

function padSpan(
  span: { start: number; end: number },
  chars: number
): { start: number; end: number } {
  return { start: span.start + chars, end: span.end + chars };
}

interface HighlightParts {
  line: string;
  lineno: number;
  content: string;
  primary: { loc: { start: number; end: number }; label?: Optional<string> };
  expanded?: Optional<{ loc: { start: number; end: number }; label?: Optional<string> }>;
}

export function highlightToParts(strings: TemplateStringsArray, ...args: string[]): HighlightParts {
  const text = buildString(strings, args);
  const leading = Math.min(
    ...text.map((s) => (isWS(s) ? Infinity : s.length - s.trimStart().length))
  );
  const lines = text.map((s) => s.slice(leading));

  const [firstLine, underlineLine, firstLabelLine, secondLabelLine] = lines;

  localAssert(
    firstLine && underlineLine,
    `invalid highlight (expected at least 2 lines): ${text.join('\n')}`
  );

  const first = parseFirst(firstLine);
  const underline = parseUnderline(underlineLine);
  const firstLabel = firstLabelLine && parseLabel(firstLabelLine);
  const secondLabel = secondLabelLine && parseLabel(secondLabelLine);
  const labels: { primary?: string; expanded?: string } = {
    ...firstLabel,
    ...secondLabel,
  };

  const primary: { loc: { start: number; end: number }; label?: Optional<string> } = {
    loc: underline.primary,
  };

  if (labels.primary) {
    primary.label = labels.primary;
  }

  const result: HighlightParts = {
    ...first,
    lineno: parseInt(first.line, 10),
    primary,
  };

  if (underline.expanded) {
    const expanded: { loc: { start: number; end: number }; label?: Optional<string> } = {
      loc: underline.expanded,
    };

    if (labels.expanded) {
      expanded.label = labels.expanded;
    }

    result.expanded = expanded;
  }

  return result;
}

function buildString(strings: TemplateStringsArray, args: string[]) {
  const text = strings
    .reduce((result, string, i) => result + `${string}${args[i] ? String(args[i]) : ''}`, '')
    .split('\n');

  const [first] = text;

  if (first !== undefined && isWS(first)) {
    text.shift();
  }

  const last = text.at(-1);

  if (last !== undefined && isWS(last)) {
    text.pop();
  }

  return text;
}

function isWS(chars: string) {
  return chars.trimStart().length === 0;
}

function parseLabel(line: string): { primary: string } | { expanded: string } {
  const regex = /^\s*\|\s+(?<type>-+|[=]+) (?<label>.*)$/u;

  const match = regex.exec(line);

  localAssert(match, `invalid label in highlight: ${line}`);

  const { type, label } = match.groups as { type: string; label: string };

  const typeChar = type[0];

  localAssert(typeChar === '=' || typeChar === '-', `invalid label type in highlight: ${line}`);

  if (typeChar === '-') {
    return { expanded: label };
  } else {
    return { primary: label };
  }
}

function parseFirst(first: string): { line: string; content: string } {
  const regex = /\s*(?<line>\d+) \| (?<content>.*)/u;

  const match = regex.exec(first);

  localAssert(match, `invalid first line in highlight: ${first}`);

  return match.groups as { line: string; content: string };
}

function parseUnderline(underline: string) {
  const regex = /^\s*\| (?<space>\s*)(?<prefix>-*)(?<primary>[=]+)(?<suffix>-*)/u;

  const match = regex.exec(underline);

  localAssert(match, `invalid underline in highlight: ${underline}`);

  const groups = match.groups as {
    space: string;
    prefix: string;
    primary: string;
    suffix: string;
  };

  const space = groups.space.length;
  const expanded =
    groups.prefix.length > 0 || groups.suffix.length > 0
      ? {
          start: space,
          end: space + groups.prefix.length + groups.primary.length + groups.suffix.length,
        }
      : undefined;
  const primary = {
    start: space + groups.prefix.length,
    end: space + groups.prefix.length + groups.primary.length,
  };

  return { primary, expanded };
}
