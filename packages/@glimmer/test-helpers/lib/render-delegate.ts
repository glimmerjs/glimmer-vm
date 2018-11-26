import { RenderResult, MutElementBuilder, Environment, Cursor } from '@glimmer/runtime';
import { Dict } from '@glimmer/util';

import { ComponentKind, ComponentTypes, TestKind } from './render-test';
import { UserHelper } from './environment/helper';
import { BasicReference } from '@glimmer/reference';
import { DebugConstants } from '@glimmer/bundle-compiler';

export default interface RenderDelegate {
  constants?: DebugConstants;
  testType?: TestKind;
  getInitialElement(): HTMLElement;
  registerComponent<K extends ComponentKind, L extends ComponentKind>(
    type: K,
    testType: L,
    name: string,
    layout: string,
    Class?: ComponentTypes[K]
  ): void;
  registerHelper(name: string, helper: UserHelper): void;
  registerModifier(name: string, klass: unknown): void;
  renderTemplate(
    template: string,
    context: Dict<unknown>,
    element: HTMLElement,
    snapshot: () => void
  ): RenderResult;
  getElementBuilder(env: Environment, cursor: Cursor): MutElementBuilder;
  getSelf(context: unknown): BasicReference<unknown>;
  resetEnv(): void;
}
