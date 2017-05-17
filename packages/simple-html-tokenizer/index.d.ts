export const HTML5NamedCharRefs: CharRef;

export class EntityParser {
  constructor(ref: CharRef);
}

export class EventedTokenizer {
  constructor(object: Object, parser: EntityParser)
}

export function tokenize(html: string, options: any): any;

export interface CharRef {
  [namedRef: string]: string;
}
