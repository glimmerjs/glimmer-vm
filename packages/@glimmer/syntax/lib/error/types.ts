import type { ChalkInstance } from 'chalk';

import type * as src from '../source/api';

/**
 * @public
 */
export interface IThemeCharacters {
  hbar: string;
  vbar: string;
  xbar: string;
  vbar_break: string;
  uarrow: string;
  rarrow: string;
  ltop: string;
  mtop: string;
  rtop: string;
  lbot: string;
  mbot: string;
  rbot: string;
  lbox: string;
  rbox: string;
  lcross: string;
  rcross: string;
  underbar: string;
  underline: string;
  fyi: string;
  x: string;
  warning: string;
  point_right: string;
}

export interface ThemeCharacters {
  /** vbar */
  '│': string;
  /** underbar */
  '┬': string;
  /** hbar */
  '─.line': string;
  /** underline */
  '─.mark': string;
  /** vbar_break */
  '·': string;
  /** uarrow */
  '▲': string;
  /** rarrow */
  '▶': string;
  /** ltop */
  '╭': string;
  /** rtop */
  '╮': string;
  /** lbot */
  '╰': string;
  /** mbot */
  '┴': string;
  /** rbot */
  '╯': string;
  /** lbox */
  '[': string;
  /** rbox */
  ']': string;
  /** lcross */
  '├': string;
  /** rcross */
  '┤': string;
  /** xbar */
  '┼': string;
  /** fyi */
  '‽': string;
  /** error */
  '×': string;
  /** warning */
  '⚠': string;
  /** advice */
  '☞': string;
}

export const SPECIAL = {
  line_break: '\n',
  space: ' ',
} as const;

export type SpecialChars = typeof SPECIAL;

export type SymbolicChars = SpecialChars & ThemeCharacters;

/**
 * @public
 */
export interface IThemeStyle {
  error: ChalkInstance;
  warning: ChalkInstance;
  advice: ChalkInstance;
  code: ChalkInstance;
  help: ChalkInstance;
  filename: ChalkInstance;
  highlights: ChalkInstance[];
}
export interface CollapsedPartition {
  type: 'collapsed';
  at: src.SourceSpan;
  line: string;
}

export interface SingleLinePartition {
  type: 'single';
  at: src.SourceSpan;
  line: string;
}
interface MultilinePartition {
  type: 'multi';
  first: {
    at: src.SourceSpan;
    line: string;
  };
  mid: {
    lineno: number;
    lines: string[];
  };
  last: {
    at: src.SourceSpan;
    line: string;
  };
}

export type LinePartition = CollapsedPartition | SingleLinePartition | MultilinePartition;
