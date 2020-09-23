import { node } from './base';
import { SourceSlice } from '../../source/slice';
import { FreeVarResolution } from './resolution';

export class ThisReference extends node('This').fields() {}
export class ArgReference extends node('Arg').fields<{ name: SourceSlice }>() {}
export class LocalVarReference extends node('Local').fields<{ name: string }>() {}
export class FreeVarReference extends node('Free').fields<{
  name: string;
  resolution: FreeVarResolution;
}>() {}

export type VariableReference = ThisReference | ArgReference | LocalVarReference | FreeVarReference;
