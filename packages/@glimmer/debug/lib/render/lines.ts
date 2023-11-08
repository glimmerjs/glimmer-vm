import type { LOCAL_LOGGER } from "@glimmer/util";
import type { DisplayFragmentOptions, FlushedLines, Fragment, LogEntry } from './fragment';
import type {IntoFormat, IntoFragment} from './presets';

import { getFlagValues } from '@glimmer/local-debug-flags';

import { prepend } from './combinators';
import { as, frag,   intoFragment } from './presets';

type FlatOp =
  | Atom
  | {
      type: 'newline';
    }
  | {
      type: 'indent';
    }
  | {
      type: 'outdent';
    };

/**
 * An Atom can't be line-broken
 */
interface Atom {
  readonly type: 'atom';
  readonly fragment: Fragment;
}

/**
 * A Fork chooses its fragment based upon whether it's broken or not.
 */
interface Fork {
  readonly type: 'fork';
  readonly oneline: SubDoc;
  readonly multi: SubDoc;
}

/**
 * If a Break is a direct child of a group and the group is rendered as a oneline, then
 * the break's oneline is rendered. Otherwise, the break is rendered as a newline.
 */
interface Break {
  readonly type: 'break';
  readonly oneline: Fragment;
}

/**
 * A nest's oneline is its prefix + its body's oneline + its suffix. A nest's multi is
 * its prefix, a nest increment, its body, a nest decrement, and its suffix.
 */
interface Nest {
  readonly type: 'nest';
  readonly oneline: {
    prefix: Fragment;
    suffix: Fragment;
  };
  readonly multi: {
    prefix: Fragment;
    suffix: Fragment;
  };
  readonly body: SubDoc;
}

/**
 * A Group can be line-broken.
 */
interface Doc {
  readonly type: 'doc';
  readonly children: SubDoc[];
}

type SubDoc = Atom | Break | Fork | Nest | Doc;

class State {
  readonly #width: number;
  #indent = 0;

  constructor(width: number) {
    this.#width = width;
  }

  indent(): void {
    this.#indent += 1;
  }

  outdent(): void {
    this.#indent -= 1;
  }

  get width() {
    return this.#width - this.#indent * 2;
  }
}

export function render(doc: Doc, width: number): FlatOp[] {
  if (onelineWidth(doc) <= width) return renderOneline(doc);

  const state = new State(width);

  return renderMulti(doc, state);
}

function renderMulti(child: SubDoc, state: State): FlatOp[] {
  switch (child.type) {
    case 'atom':
      return [child];
    case 'break':
      return [{ type: 'newline' }];
    case 'fork': {
      const width = onelineWidth(child);
      if (width <= width) {
        return renderOneline(child);
      } else {
        return renderMulti(child.multi, state);
      }
    }
    case 'nest': {
      const width = onelineWidth(child);
      if (width <= width) {
        return renderOneline(child);
      } else {
        const out: FlatOp[] = [];
        out.push({ type: 'atom', fragment: child.multi.prefix });
        state.indent();
        out.push({ type: 'indent' });
        out.push(...renderMulti(child.body, state));
        out.push({ type: 'outdent' });
        state.outdent();
        return out;
      }
    }
    case 'doc': {
      const width = onelineWidth(child);
      if (width <= width) {
        return renderOneline(child);
      } else {
        return child.children.flatMap((child) => renderMulti(child, state));
      }
    }
  }
}

function renderOneline(doc: SubDoc): FlatOp[] {
  switch (doc.type) {
    case 'atom':
      return [doc];
    case 'break':
      return [{ type: 'atom', fragment: doc.oneline }];
    case 'fork':
      return renderOneline(doc.oneline);
    case 'nest':
      return [
        { type: 'atom', fragment: doc.oneline.prefix },
        ...renderOneline(doc.body),
        { type: 'atom', fragment: doc.oneline.suffix },
      ];
    case 'doc': {
      return doc.children.flatMap(renderOneline);
    }
  }
}

function onelineWidth(subdoc: SubDoc): number {
  switch (subdoc.type) {
    case 'atom':
      return subdoc.fragment.width;
    case 'break':
      return subdoc.oneline.width;
    case 'fork':
      return onelineWidth(subdoc.oneline);
    case 'nest':
      return subdoc.oneline.prefix.width + subdoc.oneline.suffix.width + onelineWidth(subdoc.body);
    case 'doc':
      return subdoc.children.reduce((sum, breakDoc) => sum + onelineWidth(breakDoc), 0);
  }
}

export class DebugLogger {
  readonly #logger: typeof LOCAL_LOGGER;
  readonly #options: DisplayFragmentOptions;

  constructor(logger: typeof LOCAL_LOGGER, options: DisplayFragmentOptions) {
    this.#logger = logger;
    this.#options = options;
  }

  #logEntry(entry: LogEntry) {
    switch (entry.type) {
      case 'line': {
        this.#logger.debug(...entry.line);
        break;
      }

      case 'group': {
        if (entry.collapsed) {
          this.#logger.groupCollapsed(...entry.heading);
        } else {
          this.#logger.group(...entry.heading);
        }

        for (const line of entry.children) {
          this.#logEntry(line);
        }

        this.#logger.groupEnd();
      }
    }
  }

  #lines(type: 'log' | 'debug' | 'group' | 'groupCollapsed', lines: FlushedLines): void {
    const [first, ...rest] = lines;

    if (first) {
      this.#logger[type](...first.line);

      for (const entry of rest) {
        this.#logEntry(entry);
      }
    }
  }

  internals(...args: IntoFragment[]): void {
    this.#lines(
      'groupCollapsed',
      frag`🔍 ${intoFragment('internals').styleAll('internals')}`.toLog(this.#options)
    );
    this.#lines('debug', frag`${args}`.toLog(this.#options));
    this.#logger.groupEnd();
  }

  log(...args: IntoFragment[]): void {
    const fragment = frag`${args}`;

    if (!fragment.isEmpty(this.#options)) this.#lines('debug', fragment.toLog(this.#options));
  }

  labelled(label: string, ...args: IntoFragment[]): void {
    const fragment = frag`${args}`;

    const styles: IntoFormat[] = ['kw'];

    const { focus, focusColor } = getFlagValues('focus_highlight').includes(label)
      ? ({ focus: ['focus'], focusColor: ['focusColor'] } as const)
      : { focus: [], focusColor: [] };

    this.log(
      prepend(
        frag`${as.label(label)} `.styleAll(...styles, ...focus, ...focusColor),
        fragment.styleAll(...focus)
      )
    );
  }

  group(...args: IntoFragment[]): { expanded: () => () => void; collapsed: () => () => void } {
    return {
      expanded: () => {
        this.#lines('group', frag`${args}`.styleAll('unbold').toLog(this.#options));
        return () => this.#logger.groupEnd();
      },
      collapsed: () => {
        this.#lines('groupCollapsed', frag`${args}`.styleAll('unbold').toLog(this.#options));
        return () => this.#logger.groupEnd();
      },
    };
  }
}
