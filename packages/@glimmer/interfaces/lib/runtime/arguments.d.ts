import type { Nullable } from '../core';
import type { Reactive } from '../references';
import type { ScopeBlock } from './scope';

declare const CAPTURED_ARGS: unique symbol;

export interface VMArguments {
  length: number;
  positional: PositionalArguments;
  named: NamedArguments;

  at(pos: number): Reactive;
  capture(): CapturedArguments;
}

export interface CapturedArguments {
  positional: CapturedPositionalArguments;
  named: CapturedNamedArguments;
  [CAPTURED_ARGS]: true;
}

export interface PositionalArguments {
  length: number;
  at(position: number): Reactive;
  capture(): CapturedPositionalArguments;
}

export interface CapturedPositionalArguments extends Array<Reactive> {
  [CAPTURED_ARGS]: true;
}

export interface NamedArguments {
  names: readonly string[];
  length: number;
  has(name: string): boolean;
  get(name: string): Reactive;
  capture(): CapturedNamedArguments;
}

export interface BlockArguments {
  names: readonly string[];
  length: number;
  has(name: string): boolean;
  get(name: string): Nullable<ScopeBlock>;
  capture(): CapturedBlockArguments;
}

export interface CapturedBlockArguments {
  names: readonly string[];
  length: number;
  has(name: string): boolean;
  get(name: string): Nullable<ScopeBlock>;
}

export interface CapturedNamedArguments extends Record<string, Reactive> {
  [CAPTURED_ARGS]: true;
}

export interface Arguments {
  positional: readonly unknown[];
  named: Record<string, unknown>;
}
