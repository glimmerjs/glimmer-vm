import type * as src from './source/api';

import { WriteOutput } from './error/buffer';
import { Theme } from './error/theme';

export interface GlimmerSyntaxError extends Error {
  location: src.SourceSpan | null;
  code: string | null;
}

export function generateSyntaxError(message: string, location: src.SourceSpan): GlimmerSyntaxError {
  let { module, loc } = location;
  let { start, end } = loc;

  const startLine = location.src.getLine(start.line);
  const linenoWidth = `${start.line}`.length;

  let out = '';
  const buffer = new WriteOutput({
    span: location,
    theme: Theme.unicode(),
    write: (str) => (out += str),
  });

  buffer.header();

  const line = start.line;
  const column = start.column;

  buffer.gutter.lineno(String(line));
  buffer.source(location.src.getLine(line)!);
  // buffer.annotate({ line, column }, 'here');

  buffer.footer(message);

  // const theme = ThemeCharacters.unicode();
  // const msg = [
  //   `${' '.repeat(linenoWidth + 1)}${theme.ltop}${theme.hbar.repeat(linenoWidth + 3)}${
  //     theme.lbox
  //   }${module}:${start.line}:${start.column}${theme.rbox}`,
  // ];

  // msg.push(`${start.line} ${theme.vbar} ${startLine}`);
  // msg.push(
  //   `${' '.repeat(linenoWidth)} ${theme.vbar_break} ${' '.repeat(start.column)}${theme.uarrow}`
  // );

  // console.log(msg.join('\n'));

  // const msg = DiagnosticsMessage.createError(location.module, {
  //   text: message,
  //   linenumber: line,
  //   column,
  // }).setLevel(DiagnosticsLevelEnum.Error);

  // let output = '';

  // m.render({ write: (str) => (output += str) });

  // // let code = location.asString();
  // let quotedCode = code ? `\n\n|\n|  ${code.split('\n').join('\n|  ')}\n|\n\n` : '';

  let error = new Error('\n' + out) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = location;
  error.code = location.asString();

  return error;
}

function isCollapsed(span: src.SourceSpan): boolean {
  return (
    span.endPosition.line === span.startPosition.line &&
    span.endPosition.column - span.startPosition.column <= 1
  );
}

function isMultiline(span: src.SourceSpan): boolean {
  return span.endPosition.line > span.startPosition.line;
}
