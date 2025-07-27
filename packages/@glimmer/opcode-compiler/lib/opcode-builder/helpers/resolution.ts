import type {
  BlockMetadata,
  BlockSymbolNames,
  ClassicResolver,
  CompileTimeComponent,
  Expressions,
  Nullable,
  Owner,
  ProgramConstants,
  ResolutionTimeConstants,
} from '@glimmer/interfaces';
import { localAssert, unwrap } from '@glimmer/debug-util';
import { SexpOpcodes } from '@glimmer/wire-format';

interface ResolvedBlockMetadata extends BlockMetadata {
  owner: Owner;
  symbols: BlockSymbolNames & {
    upvars: string[];
  };
}

export function assertResolverInvariants(meta: BlockMetadata): ResolvedBlockMetadata {
  if (import.meta.env.DEV) {
    if (!meta.symbols.upvars) {
      throw new Error(
        'Attempted to resolve a component, helper, or modifier, but no free vars were found'
      );
    }

    if (!meta.owner) {
      throw new Error(
        'Attempted to resolve a component, helper, or modifier, but no owner was associated with the template it was being resolved from'
      );
    }
  }

  return meta as unknown as ResolvedBlockMetadata;
}

export function resolveKeywordComponent(meta: BlockMetadata, expr: Expressions.Expression) {
  localAssert(
    Array.isArray(expr),
    'Expected to find an expression when resolving a lexical component'
  );

  if (import.meta.env.DEV && expr[0] === SexpOpcodes.GetKeyword) {
    localAssert(!meta.isStrictMode, 'Strict mode errors should already be handled at compile time');

    throw new Error(
      `Attempted to resolve a component in a strict mode template, but that value was not in scope: ${
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        meta.symbols.upvars![expr[1]] ?? '{unknown variable}'
      }`
    );
  }
}

/**
 * <Foo/>
 * <Foo></Foo>
 * <Foo @arg={{true}} />
 */
export function resolveComponent(
  resolver: Nullable<ClassicResolver>,
  constants: ProgramConstants,
  meta: BlockMetadata,
  upvar: number
): CompileTimeComponent {
  let {
    symbols: { upvars },
    owner,
  } = assertResolverInvariants(meta);

  let name = unwrap(upvars[upvar]);
  let definition = resolver?.lookupComponent?.(name, owner) ?? null;

  if (import.meta.env.DEV && (typeof definition !== 'object' || definition === null)) {
    localAssert(!meta.isStrictMode, 'Strict mode errors should already be handled at compile time');

    throw new Error(
      `Attempted to resolve \`${name}\`, which was expected to be a component, but nothing was found.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
  return constants.resolvedComponent(definition!, name);
}

/**
 * <div {{modifier}}/>
 * <div {{modifier arg}}/>
 * <Foo {{modifier}}/>
 */
export function resolveModifier(
  resolver: Nullable<ClassicResolver>,
  constants: ProgramConstants,
  meta: BlockMetadata,
  upvar: number
): number {
  let {
    symbols: { upvars },
    owner,
  } = assertResolverInvariants(meta);
  let name = unwrap(upvars[upvar]);
  let modifier = resolver?.lookupModifier?.(name, owner) ?? null;

  if (import.meta.env.DEV && modifier === null) {
    localAssert(!meta.isStrictMode, 'Strict mode errors should already be handled at compile time');

    throw new Error(
      `Attempted to resolve \`${name}\`, which was expected to be a modifier, but nothing was found.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
  return constants.modifier(modifier!);
}

/**
 * {{component-or-helper arg}}
 */
export function resolveAppendable(
  resolver: Nullable<ClassicResolver>,
  constants: ProgramConstants,
  meta: BlockMetadata,
  upvar: number,
  { ifComponent, ifHelper }: ResolveAppendInvokableOptions
): void {
  let {
    symbols: { upvars },
    owner,
  } = assertResolverInvariants(meta);

  let name = unwrap(upvars[upvar]);
  let definition = resolver?.lookupComponent?.(name, owner) ?? null;

  if (definition !== null) {
    ifComponent(constants.resolvedComponent(definition, name));
  } else {
    let helper = resolver?.lookupHelper?.(name, owner) ?? null;

    if (import.meta.env.DEV && helper === null) {
      localAssert(
        !meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        `Attempted to resolve \`${name}\`, which was expected to be a component or helper, but nothing was found.`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    ifHelper(constants.helper(helper!, name));
  }
}

export interface ResolveAppendInvokableOptions {
  ifComponent: (component: CompileTimeComponent) => void;
  ifHelper: (handle: number) => void;
}

export interface ResolveAppendableOptions {
  ifComponent: (component: CompileTimeComponent) => void;
  ifHelper: (handle: number) => void;
}

/**
 * {{maybeHelperOrComponent}}
 */
export function resolveAppendAny(
  resolver: Nullable<ClassicResolver>,
  constants: ProgramConstants,
  meta: BlockMetadata,
  expr: Expressions.ResolveAsUnknownAppend,
  { ifComponent, ifHelper }: ResolveAppendInvokableOptions
): void {
  let {
    symbols: { upvars },
    owner,
  } = assertResolverInvariants(meta);

  let name = unwrap(upvars[expr[1]]);
  let definition = resolver?.lookupComponent?.(name, owner) ?? null;

  if (definition !== null) {
    ifComponent(constants.resolvedComponent(definition, name));
    return;
  }

  let helper = resolver?.lookupHelper?.(name, owner) ?? null;

  if (helper !== null) {
    ifHelper(constants.helper(helper, name));
  }
}

export function lookupBuiltInHelper(
  expr: Expressions.GetKeyword,
  resolver: Nullable<ClassicResolver>,
  meta: BlockMetadata,
  constants: ResolutionTimeConstants,
  type: string
): number {
  let {
    symbols: { upvars },
  } = assertResolverInvariants(meta);

  let name = unwrap(upvars[expr[1]]);
  let helper = resolver?.lookupBuiltInHelper?.(name) ?? null;

  if (import.meta.env.DEV && helper === null) {
    localAssert(!meta.isStrictMode, 'Strict mode errors should already be handled at compile time');

    // Keyword helper did not exist, which means that we're attempting to use a
    // value of some kind that is not in scope
    throw new Error(
      `Attempted to resolve a ${type} in a strict mode template, but that value was not in scope: ${
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        meta.symbols.upvars![expr[1]] ?? '{unknown variable}'
      }`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
  return constants.helper(helper!, name);
}
