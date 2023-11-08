import type { Dict, Maybe } from '@glimmer/interfaces';
import type { BuildStyle } from './delegate';

export class InvocationBuilder {
  static ANGLE = new InvocationBuilder('angle');
  static CURLIES = new InvocationBuilder('curlies');

  readonly #style: BuildStyle;

  constructor(style: BuildStyle) {
    this.#style = style;
  }

  args(args: Dict): string {
    return buildArgs(ARGS[this.#style])(args);
  }

  attributes(attrs: Dict = {}) {
    return buildArgs(ATTRS[this.#style])(attrs);
  }

  blockParams(blockParams: string[]): string {
    return `${blockParams.length > 0 ? ` as |${blockParams.join(' ')}|` : ''}`;
  }

  else(elseBlock: string | undefined): string {
    return `${elseBlock ? `{{else}}${elseBlock}` : ''}`;
  }
}

const ARGS = {
  angle: { sigil: '@', curlies: true },
  curlies: { sigil: '', curlies: false },
} as const;

const ATTRS = {
  angle: { sigil: '', curlies: true },
  curlies: { sigil: '', curlies: false },
} as const;

export function buildArgs({
  sigil,
  curlies,
}: {
  sigil: string;
  curlies: boolean;
}): (args: Dict) => string {
  return (args) => {
    return `${Object.keys(args)
      .map((arg) => {
        let rightSide: string;

        let value = args[arg] as Maybe<string[]>;
        if (curlies) {
          let isString = value && (value[0] === "'" || value[0] === '"');
          if (isString) {
            rightSide = `${value}`;
          } else {
            rightSide = `{{${value}}}`;
          }
        } else {
          rightSide = `${value}`;
        }

        return `${sigil}${arg}=${rightSide}`;
      })
      .join(' ')}`;
  };
}
