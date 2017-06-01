import { Bounds } from '../bounds';
import { DOMChanges, DOMTreeConstruction } from '../dom/helper';
import { Option } from '@glimmer/util';
import { INCLUDE_LEGACY } from "@glimmer/feature-flags";

// Patch:    Adjacent text node merging fix
// Browsers: IE, Edge, Firefox w/o inspector open
// Reason:   These browsers will merge adjacent text nodes. For exmaple given
//           <div>Hello</div> with div.insertAdjacentHTML(' world') browsers
//           with proper behavior will populate div.childNodes with two items.
//           These browsers will populate it with one merged node instead.
// Fix:      Add these nodes to a wrapper element, then iterate the childNodes
//           of that wrapper and move the nodes to their target location. Note
//           that potential SVG bugs will have been handled before this fix.
//           Note that this fix must only apply to the previous text node, as
//           the base implementation of `insertHTMLBefore` already handles
//           following text nodes correctly.
export function domChanges(document: Option<Document>, DOMChangesClass: typeof DOMChanges): typeof DOMChanges {
  if (INCLUDE_LEGACY) {
    if (!document) return DOMChangesClass;

    if (!shouldApplyFix(document)) {
      return DOMChangesClass;
    }

    return class DOMChangesWithTextNodeMergingFix extends DOMChangesClass {
      private uselessComment: Comment;

      constructor(document: Document) {
        super(document);
        this.uselessComment = document.createComment('');
      }

      insertHTMLBefore(parent: HTMLElement, nextSibling: Node, html: string): Bounds {
        if (html === null) {
          return super.insertHTMLBefore(parent, nextSibling, html);
        }

        let didSetUselessComment = false;

        let nextPrevious = nextSibling ? nextSibling.previousSibling : parent.lastChild;
        if (nextPrevious && nextPrevious instanceof Text) {
          didSetUselessComment = true;
          parent.insertBefore(this.uselessComment, nextSibling);
        }

        let bounds = super.insertHTMLBefore(parent, nextSibling, html);

        if (didSetUselessComment) {
          parent.removeChild(this.uselessComment);
        }

        return bounds;
      }
    };
  } else {
    return DOMChangesClass;
  }
}

export function treeConstruction(document: Option<Document>, TreeConstructionClass: typeof DOMTreeConstruction): typeof DOMTreeConstruction {
  if (INCLUDE_LEGACY) {
    if (!document) return TreeConstructionClass;

    if (!shouldApplyFix(document)) {
      return TreeConstructionClass;
    }

    return class TreeConstructionWithTextNodeMergingFix extends TreeConstructionClass {
      private uselessComment: Comment;

      constructor(document: Document) {
        super(document);
        this.uselessComment = this.createComment('') as Comment;
      }

      insertHTMLBefore(parent: HTMLElement, reference: Node, html: string): Bounds {
        if (html === null) {
          return super.insertHTMLBefore(parent, reference, html);
        }

        let didSetUselessComment = false;

        let nextPrevious = reference ? reference.previousSibling : parent.lastChild;
        if (nextPrevious && nextPrevious instanceof Text) {
          didSetUselessComment = true;
          parent.insertBefore(this.uselessComment, reference);
        }

        let bounds = super.insertHTMLBefore(parent, reference, html);

        if (didSetUselessComment) {
          parent.removeChild(this.uselessComment);
        }

        return bounds;
      }
    };
  } else {
    return TreeConstructionClass;
  }
}

function shouldApplyFix(document: Document) {
  if (INCLUDE_LEGACY) {
    let mergingTextDiv: HTMLDivElement = document.createElement('div');

    mergingTextDiv.innerHTML = 'first';
    mergingTextDiv.insertAdjacentHTML('beforeEnd', 'second');

    if (mergingTextDiv.childNodes.length === 2) {
      // It worked as expected, no fix required
      return false;
    }

    return true;
  }

  return;
}
