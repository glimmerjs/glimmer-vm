import type { Optional } from '@glimmer/interfaces';
import { localAssert } from '@glimmer/debug-util';

import type * as src from './source/api';
import type { VariableReferenceValidationContext } from './validation-context';

export interface GlimmerSyntaxError extends Error {
  location: src.SourceSpan | null;
  code: string | null;
}

export function unresolvedBindingError({
  context,
  notes = [],
}: {
  context: VariableReferenceValidationContext;
  notes?: string[] | undefined;
}): GlimmerSyntaxError {
  const loc = context.loc;
  const module = loc.module;
  let { line, column } = loc.startPosition;

  const quotedCode = quoteInvalidPath(context, 'not in scope');
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  const allNotes = [...context.notes, ...notes];

  if (quotedCode || allNotes.length > 0) {
    const notesString =
      allNotes.length > 0 ? `${allNotes.map((n) => `NOTE: ${n}`).join('\n\n')}\n\n` : '';
    message = `${context.error}:${quotedCode}${notesString}${where}`;
  } else {
    message = `${context.error}: ${where}`;
  }

  const code = loc.asString();

  let error = new Error(message) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = loc;
  error.code = code;

  return error;
}

export function invalidExprError(
  header: string,
  { context, notes, problem }: { context: ValidationContext; notes?: string[]; problem: string }
): GlimmerSyntaxError {
  const loc = context.loc;
  const module = loc.module;
  let { line, column } = loc.startPosition;

  const quotedCode = quoteInvalid(context, problem);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  if (quotedCode || notes) {
    const notesString = notes ? `\n\n${notes.map((n) => `NOTE: ${n}`).join('\n\n')}\n\n` : '';
    message = `${header}:${quotedCode}${notesString}${where}`;
  } else {
    message = `${header}: ${where}`;
  }

  const code = loc.asString();

  let error = new Error(message) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = loc;
  error.code = code;

  return error;
}

export function generateSyntaxError(message: string, location: src.SourceSpan): GlimmerSyntaxError {
  let { module, loc } = location;
  let { line, column } = loc.start;

  let code = location.asString();

  let quotedCode = simpleQuote(location);

  let error = new Error(
    `${message}: ${quotedCode}(error occurred in '${module}' @ line ${line} : column ${column})`
  ) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = location;
  error.code = code;

  return error;
}

function quoteInvalid(context: ValidationContext, problem: string): string {
  if (context.kind === 'path') {
    return quoteInvalidPath(context, problem);
  }

  if (context.kind === 'expr') {
    return quoteInvalidExpr(context, problem);
  }

  return simpleQuote(context.loc);
}

function quoteInvalidExpr(context: OuterExpressionValidationContext, problem: string): string {
  const highlightContext = context.content;

  const underline = drawUnderline(highlightContext, context.outer, problem);
  const codeString = highlightContext.asString();

  return `\n\n|  ${codeString}\n${underline}\n\n`;
}

function quoteInvalidPath(validation: VariableReferenceValidationContext, problem: string): string {
  const { path, head } = validation.path;
  const highlightContext = validation.context;

  // const { callee, syntax } = context;

  const fullContext = highlightContext.fullLines();
  // const highlightContext = context.highlightContext;

  // if (!highlightContext || !callee) {
  //   return simpleQuote(context.path);
  // }

  // const { path, head } = callee;

  const codeString = highlightContext.asString();

  const fullRange = LineRange.for(
    highlightContext.getSource(),
    fullContext.startPosition.line,
    fullContext.endPosition.line
  );

  const lines = new LineBuffers([...fullRange]);
  const code = lines
    .forLine(path.startPosition.line, highlightContext.startPosition.column)
    .add(codeString);

  const underline = drawPathUnderline(lines, highlightContext, path, head ?? path, problem, 'todo');
  return `\n\n${code}\n${underline}\n\n`;
}

function simpleQuote(location: src.SourceSpan) {
  const code = location.asString();
  return code ? `\n\n|\n|  ${code.split('\n').join('\n|  ')}\n|\n\n` : '';
}

function primaryPositions(
  path: src.SourceSpan,
  head: src.SourceSpan
): { at: number; end: number; chars: string; under: [string, string] } {
  const start = head.startPosition.column;
  const primarySize = head.endPosition.column - head.startPosition.column;
  const secondarySize = path.endPosition.column - head.endPosition.column;

  localAssert(primarySize > 0, `The size of the path for a path error must be greater than 0`);

  if (primarySize === 1) {
    return {
      at: start,
      end: start + primarySize,
      chars: secondarySize > 0 ? '┳' : '╮',
      under: ['┃', '┗'],
    };
  } else if (primarySize === 2) {
    return {
      at: start,
      end: start + primarySize,
      chars: secondarySize > 0 ? '━┳' : '━┑',
      under: [' ┃', ' ┗'],
    };
  } else {
    return {
      at: start,
      end: start + primarySize,
      chars: `━┳${'━'.repeat(primarySize - 2)}`,
      under: [' ┃', ' ┗'],
    };
  }
}

function secondaryPositions(
  path: src.SourceSpan,
  head: src.SourceSpan
): { at: number; end: number; chars: string; under: string } | undefined {
  const start = head.endPosition.column;
  const secondarySize = path.endPosition.column - head.endPosition.column;

  if (secondarySize === 0) {
    return;
  }

  if (secondarySize === 1) {
    return {
      at: start,
      end: start + secondarySize,
      chars: '╮',
      under: '└',
    };
  } else if (secondarySize === 2) {
    return {
      at: start,
      end: start + secondarySize,
      chars: '─╮',
      under: ' └',
    };
  } else {
    return {
      at: start,
      end: start + secondarySize,
      chars: `─┬${'─'.repeat(secondarySize - 2)}`,
      under: ' └',
    };
  }
}

function drawPathUnderline(
  buffers: LineBuffers,
  highlightContext: src.SourceSpan,
  path: src.SourceSpan,
  head: src.SourceSpan,
  problem: string,
  syntax: string
) {
  const primary = primaryPositions(path, head);
  const secondary = secondaryPositions(path, head);

  const line1 = buffers
    .blank(highlightContext.startPosition.column)
    .until(primary.at, ' ')
    .add(primary.chars)
    .add(secondary?.chars);

  const line2 = buffers.blank(highlightContext.startPosition.column);

  if (secondary) {
    line2
      .until(primary.at, ' ')
      .add(primary.under[0])
      .until(secondary.at, ' ')
      .add(secondary.under)
      .until(Math.max(primary.end, secondary.end), '─')
      .space()
      .add(syntax);
    const line3 = buffers
      .blank(highlightContext.startPosition.column)
      .until(primary.at, ' ')
      .add(primary.under[1])
      .until(Math.max(primary.end, secondary.end), '━')
      .space()
      .add(problem);
    return `${line1}\n${line2}\n${line3}\n`;
  } else {
    line2
      .until(primary.at, ' ')
      .add(primary.under[1])
      .until(Math.max(primary.end), '━')
      .space()
      .add(`${syntax} ${problem}`);
  }

  return `${line1}\n${line2}\n`;
}

class LineBuffers {
  #lines: number[];

  constructor(lines: number[]) {
    this.#lines = lines;
  }

  get #width() {
    return Math.max(...this.#lines.map((l) => String(l).length));
  }

  forLine(line: number, startColumn: number) {
    return new LineBuffer(`${String(line).padStart(this.#width)} | `, startColumn);
  }

  blank(startColumn: number) {
    return new LineBuffer(`${' '.repeat(this.#width)} | `, startColumn);
  }
}

class LineBuffer {
  #offset: number = 0;
  #content: string;
  #startColumn: number;

  constructor(gutter: string, startColumn: number) {
    this.#content = gutter;
    this.#startColumn = startColumn;
  }

  add(str: Optional<string>) {
    if (str === undefined) {
      return this;
    }

    this.#content += str;
    this.#offset += str.length;
    return this;
  }

  space() {
    return this.add(' ');
  }

  until(offset: number, padding: string) {
    this.#content += padding.repeat(offset - this.#offset - this.#startColumn);
    this.#offset = offset - this.#startColumn;
    return this;
  }

  toString(): string {
    return this.#content;
  }

  get line(): string {
    return `${this.#content}\n`;
  }
}

function drawUnderline(highlightContext: src.SourceSpan, head: src.SourceSpan, problem: string) {
  const primarySize = head.endPosition.column - head.startPosition.column;
  const primary = primarySize > 0 ? '━'.repeat(primarySize) : '';
  const trailSize = head.endPosition.column - highlightContext.endPosition.column;
  const trail = trailSize > 0 ? '┈'.repeat(trailSize) : '';

  return `|  ${' '.repeat(head.startPosition.column - highlightContext.startPosition.column)}${primary}${trail}┈┈┈┈┈ ${problem}\n`;
}

class LineRange implements Iterable<number> {
  static for(source: src.Source, start: number, end: number): LineRange {
    return new LineRange(source, start, end);
  }

  #source: src.Source;
  #start: number;
  #end: number;

  constructor(source: src.Source, start: number, end: number) {
    this.#source = source;
    this.#start = start;
    this.#end = end;
  }

  *[Symbol.iterator]() {
    for (let i = this.#start; i <= this.#end; i++) {
      yield i;
    }
  }

  get first(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#source.getLine(this.#start)!;
  }

  get last(): Optional<string> {
    return this.#source.getLine(this.#end);
  }

  get(line: number): Optional<string> {
    return this.#source.getLine(line);
  }

  get size() {
    return this.#end - this.#start + 1;
  }

  contains(pos: number): boolean {
    return pos >= this.#start && pos <= this.#end;
  }
}
