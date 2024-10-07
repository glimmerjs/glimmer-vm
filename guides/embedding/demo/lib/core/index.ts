import type { Dict } from '@glimmer/interfaces';
import type { SimpleDocument, SimpleElement } from '@simple-dom/interface';

export interface RenderComponentOptions {
  element: SimpleElement;
  interactive?: boolean;
  args?: Dict<unknown>;
  owner?: object;
  rehydrate?: boolean;
}

export interface EnvRuntimeOptions {
  /**
   * The document that should be used to create DOM nodes. In SSR mode,
   * this is a SimpleDOM Document, but it's usually a regular document.
   */
  document: SimpleDocument | Document;
  /**
   * An interactive environment runs element modifiers, while a
   * non-interactive environment (i.e. SSR) does not.
   *
   * This defaults to true when the document is an instance of
   * `globalThis.Document`, and false otherwise.
   */
  interactive?: boolean;
  /**
   * Setting this to true enables Glimmer's debug tooling, which
   * installs an instance of `DebugRenderTree` on the environment.
   */
  debug?: boolean;
  /**
   * This callback will be called after the Glimmer runtime commits
   * a render transaction.
   */
  onCommit?: () => void;
}
