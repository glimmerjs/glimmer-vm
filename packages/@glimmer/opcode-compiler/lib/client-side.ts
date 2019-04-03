import { Ops as WireFormatOps } from '@glimmer/wire-format';

export enum Ops {
  OpenComponentElement,
  DidCreateElement,
  DidRenderLayout,
  Debugger,
}

import ClientSideStatement = WireFormatOps.ClientSideStatement;

export type OpenComponentElement = [ClientSideStatement, Ops.OpenComponentElement, string];
export type DidCreateElement = [ClientSideStatement, Ops.DidCreateElement];
export type DidRenderLayout = [ClientSideStatement, Ops.DidRenderLayout];

export type ClientSideStatement = OpenComponentElement | DidCreateElement | DidRenderLayout;
