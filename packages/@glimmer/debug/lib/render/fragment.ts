import type { SimpleNode } from '@glimmer/interfaces';
import { intoFormat, STYLES, type IntoFormat } from './presets';
import { assertNever } from '@glimmer/util';

interface AbstractLeafFragment {
  readonly value: unknown;
  readonly style?: string | undefined;
  readonly subtle?: boolean;
}

export interface ValueFragment extends AbstractLeafFragment {
  readonly kind: 'value';
  readonly value: unknown;
  readonly annotation?: { compact: string; full: Fragment } | undefined;
}

export interface StringFragment extends AbstractLeafFragment {
  readonly kind: 'string';
  readonly value: string;
}

export interface IntegerFragment extends AbstractLeafFragment {
  readonly kind: 'integer';
  readonly value: number;
}

export interface DomFragment extends AbstractLeafFragment {
  readonly kind: 'dom';
  readonly value: SimpleNode | Node;
}

export type LeafFragmentType = StringFragment | IntegerFragment | ValueFragment | DomFragment;

const FORMATTERS = {
  value: '%O',
  string: '%s',
  integer: '%d',
  dom: '%o',
} as const;

export type FragmentType =
  | LeafFragmentType
  | {
      kind: 'multi';
      value: LeafFragment[];
    };

export type LeafFragment = Fragment<LeafFragmentType>;

export interface DisplayFragmentOptions {
  readonly showSubtle: boolean;
}

export class Fragment<T extends FragmentType = FragmentType> {
  readonly #type: T;

  constructor(type: T) {
    this.#type = type;
  }

  get width() {
    return this.leaves().reduce((sum, leaf) => {
      const { kind, value } = leaf.#type;

      switch (kind) {
        case 'integer':
        case 'string':
          return sum + String(value).length;
        case 'value':
        case 'dom':
          // @fixme this assumes one-digit references
          return sum + '[]'.length + 1;
      }
    }, 0);
  }

  isSubtle(): boolean {
    return this.leaves().every((leaf) => leaf.#type.subtle);
  }

  map(ifPresent: (value: Fragment) => Fragment): Fragment {
    if (this.isEmpty()) return this;
    const fragment = ifPresent(this);
    return this.isSubtle() ? fragment.subtle() : fragment;
  }

  isEmpty(options: DisplayFragmentOptions = { showSubtle: true }): boolean {
    return this.leaves().every((leaf) => !leaf.#shouldShow(options));
  }

  leaves(): LeafFragment[] {
    if (this.#type.kind === 'multi') {
      return this.#type.value.flatMap((f) => f.leaves());
    } else if (this.#type.kind === 'string' && this.#type.value === '') {
      return [];
    } else {
      return [this as LeafFragment];
    }
  }

  subtle(isSubtle = true): Fragment<T> {
    const fragment = this.#subtle(isSubtle);
    return isSubtle ? fragment.styleAll('subtle') : fragment;
  }

  #subtle(isSubtle: boolean): Fragment<T> {
    if (this.#type.kind === 'multi') {
      return new Fragment({
        ...this.#type,
        value: this.leaves().flatMap((f) => f.subtle(isSubtle).leaves()),
      });
    } else {
      return new Fragment({
        ...this.#type,
        subtle: isSubtle,
      });
    }
  }

  styleAll(allStyle: IntoFormat | undefined): Fragment<T> {
    if (allStyle === undefined) return this;

    if (this.#type.kind === 'multi') {
      return new Fragment({
        ...this.#type,
        value: this.#type.value.flatMap((f) => f.styleAll(allStyle).leaves()),
      });
    } else {
      return new Fragment({
        ...this.#type,
        style: mergeStyle(this.#type.style, intoFormat(allStyle).style),
      });
    }
  }

  stringify(options: DisplayFragmentOptions): string {
    return this.leaves()
      .filter((leaf) => leaf.#shouldShow(options))
      .map((leaf) => {
        const fragment = leaf.#type;

        if (fragment.kind === 'value') {
          return `<object>`;
        } else {
          return String(fragment.value);
        }
      })
      .join('');
  }

  #shouldShow(options: DisplayFragmentOptions): boolean {
    return this.leaves().some((leaf) => {
      const fragment = leaf.#type;

      if (fragment.subtle && !options.showSubtle) {
        return false;
      } else if (fragment.kind === 'string' && fragment.value === '') {
        return false;
      }

      return true;
    });
  }

  toLog(options: DisplayFragmentOptions): LogLine[] {
    const buffer = new LogFragmentBuffer(options);

    for (const leaf of this.leaves()) {
      leaf.appendTo(buffer);
    }

    return buffer.flush();
  }

  appendTo(buffer: LogFragmentBuffer): void {
    const fragment = this.#type;

    if (fragment.kind === 'value') {
      if (fragment.value === null || fragment.value === undefined) {
        return this.#asString(String(fragment.value), STYLES.null).appendTo(buffer);
      } else if (typeof fragment.value === 'string') {
        return this.#asString(JSON.stringify(fragment.value), STYLES.string).appendTo(buffer);
      } else if (typeof fragment.value === 'number') {
        return this.#asString(String(fragment.value), STYLES.number).appendTo(buffer);
      }
    }

    if (fragment.kind === 'multi') {
      for (const f of fragment.value) {
        f.appendTo(buffer);
      }
    } else {
      switch (fragment.kind) {
        case 'string':
        case 'integer':
          buffer.append(
            fragment.subtle ?? false,
            `%c${FORMATTERS[fragment.kind]}`,
            fragment.style,
            fragment.value
          );
          break;
        case 'dom':
        case 'value': {
          const annotation = fragment.kind === 'value' ? fragment.annotation : undefined;
          const index = buffer.nextFootnote;
          const style = ANNOTATION_STYLES[index % ANNOTATION_STYLES.length] as string;

          if (annotation) {
            annotation.full.subtle(this.isSubtle()).styleAll({ style }).appendTo(buffer);
          } else {
            buffer.append(fragment.subtle ?? false, `%c[${buffer.nextFootnote}]`, style);
          }

          buffer.enqueue(
            fragment.subtle ?? false,
            `%c[${annotation?.compact ?? buffer.nextFootnote}]%c %c${FORMATTERS[fragment.kind]}`,
            style,
            '',
            mergeStyle(fragment.style, style),
            fragment.value
          );
          break;
        }
        default:
          assertNever(fragment);
      }
    }
  }

  #asString(value: string, style?: string | undefined): Fragment {
    return new Fragment({
      kind: 'string',
      value,
      style,
      subtle: this.isSubtle(),
    });
  }
}

export interface LogLine {
  readonly line: unknown[];
}

interface QueuedLine {
  subtle: boolean;
  template: string;
  substitutions: unknown[];
}

export class LogFragmentBuffer {
  #template = '';
  readonly #options: DisplayFragmentOptions;
  readonly #substitutions: unknown[] = [];
  readonly #queued: QueuedLine[] = [];

  constructor(options: DisplayFragmentOptions) {
    this.#options = options;
  }

  get nextFootnote(): number {
    return this.#queued.length;
  }

  enqueue(subtle: boolean, template: string, ...substitutions: unknown[]): void {
    this.#queued.push({ subtle, template, substitutions });
  }

  append(subtle: boolean, template: string, ...substitutions: unknown[]) {
    if (subtle && !this.#options.showSubtle) return;
    this.#template += template;

    this.#substitutions.push(...substitutions);
  }

  flush(): LogLine[] {
    return [
      { line: [this.#template, ...this.#substitutions] },
      ...this.#queued.flatMap((f) => {
        if (f.subtle && !this.#options.showSubtle) return [];
        return [{ line: [f.template, ...f.substitutions] }];
      }),
    ];
  }
}

function mergeStyle(a?: string | undefined, b?: string | undefined): string | undefined {
  if (a && b) {
    return `${a}; ${b}`;
  } else {
    return a || b;
  }
}

const ANNOTATION_STYLES = [
  'background-color: oklch(93% 0.03 300); color: oklch(34% 0.18 300)',
  'background-color: oklch(93% 0.03 250); color: oklch(34% 0.18 250)',
  'background-color: oklch(93% 0.03 200); color: oklch(34% 0.18 200)',
  'background-color: oklch(93% 0.03 150); color: oklch(34% 0.18 150)',
  'background-color: oklch(93% 0.03 100); color: oklch(34% 0.18 100)',
  'background-color: oklch(93% 0.03 50); color: oklch(34% 0.18 50)',
  'background-color: oklch(93% 0.03 0); color: oklch(34% 0.18 0)',
] as const;
