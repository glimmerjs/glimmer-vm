import { FIXME, InternedString, Opaque } from 'glimmer-util';
import { SafeString, isSafeString } from './upsert';
import { DOMHelper } from './dom';

const badProtocols = {
  'javascript:': true,
  'vbscript:': true
};

const badTags = {
  'A': true,
  'BODY': true,
  'LINK': true,
  'IMG': true,
  'IFRAME': true,
  'BASE': true,
  'FORM': true
};

const badTagsForDataURI = {
  'EMBED': true
};

export const badAttributes = {
  'href': true,
  'src': true,
  'background': true,
  'action': true
};

const badAttributesForDataURI = {
  'src': true
};

type StringType = string | SafeString;

export function requiresSanitization(tagName: string, attribute: string): boolean {
  return (((tagName === null || badTags[tagName]) && badAttributes[attribute]) || (badTagsForDataURI[tagName] && badAttributesForDataURI[attribute]));
}

export function sanitizeAttributeValue(dom: DOMHelper, element: Element, attribute: string, value: Opaque): Opaque {
  let tagName;

  if (!element) {
    tagName = null;
  } else {
    tagName = element.tagName.toUpperCase();
  }

  if (isSafeString(value)) {
    return value.toHTML();
  }

  if ((tagName === null || badTags[tagName]) && badAttributes[attribute]) {
    var protocol = dom.protocolForURL(value as FIXME<string>);
    if (badProtocols[protocol] === true) {
      return `unsafe:${value}`;
    }
  }

  if (badTagsForDataURI[tagName] && badAttributesForDataURI[attribute]) {
    return `unsafe:${value}`;
  }

  return value;
}
