/**
 * This package contains global context functions for Glimmer. These functions
 * are set by the embedding environment and must be set before initial render.
 *
 * These functions should meet the following criteria:
 *
 * - Must be provided by the embedder, due to having framework specific
 *   behaviors (e.g. interop with classic Ember behaviors that should not be
 *   upstreamed) or to being out of scope for the VM (e.g. scheduling a
 *   revalidation)
 * - Never differ between render roots
 * - Never change over time
 *
 */
/**
 * Interfaces
 *
 * TODO: Move these into @glimmer/interfaces, move @glimmer/interfaces to
 * @glimmer/internal-interfaces.
 */
interface IteratorDelegate {
    isEmpty(): boolean;
    next(): {
        value: unknown;
        memo: unknown;
    } | null;
}
export type Destroyable = object;
export type Destructor<T extends Destroyable> = (destroyable: T) => void;
/**
 * Schedules a VM revalidation.
 *
 * Note: this has a default value so that tags can warm themselves when first loaded.
 */
export declare let scheduleRevalidate: () => void;
/**
 * Schedules a destructor to run
 *
 * @param destroyable The destroyable being destroyed
 * @param destructor The destructor being scheduled
 */
export declare let scheduleDestroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => void;
/**
 * Finalizes destruction
 *
 * @param finalizer finalizer function
 */
export declare let scheduleDestroyed: (finalizer: () => void) => void;
/**
 * Hook to provide iterators for `{{each}}` loops
 *
 * @param value The value to create an iterator for
 */
export declare let toIterator: (value: unknown) => IteratorDelegate | null;
/**
 * Hook to specify truthiness within Glimmer templates
 *
 * @param value The value to convert to a boolean
 */
export declare let toBool: (value: unknown) => boolean;
/**
 * Hook for specifying how Glimmer should access properties in cases where it
 * needs to. For instance, accessing an object's values in templates.
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export declare let getProp: (obj: object, path: string) => unknown;
/**
 * Hook for specifying how Glimmer should update props in cases where it needs
 * to. For instance, when updating a template reference (e.g. 2-way-binding)
 *
 * @param obj The object provided to get a value from
 * @param prop The prop to set the value at
 * @param value The value to set the value to
 */
export declare let setProp: (obj: object, prop: string, value: unknown) => void;
/**
 * Hook for specifying how Glimmer should access paths in cases where it needs
 * to. For instance, the `key` value of `{{each}}` loops.
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export declare let getPath: (obj: object, path: string) => unknown;
/**
 * Hook for specifying how Glimmer should update paths in cases where it needs
 * to. For instance, when updating a template reference (e.g. 2-way-binding)
 *
 * @param obj The object provided to get a value from
 * @param path The path to get the value from
 */
export declare let setPath: (obj: object, path: string, value: unknown) => unknown;
/**
 * Hook to warn if a style binding string or value was not marked as trusted
 * (e.g. HTMLSafe)
 */
export declare let warnIfStyleNotTrusted: (value: unknown) => void;
/**
 * Hook to customize assertion messages in the VM. Usages can be stripped out
 * by using the @glimmer/vm-babel-plugins package.
 */
export declare let assert: (test: unknown, msg: string, options?: {
    id: string;
}) => asserts test;
/**
 * Hook to customize deprecation messages in the VM. Usages can be stripped out
 * by using the @glimmer/vm-babel-plugins package.
 */
export declare let deprecate: (msg: string, test: unknown, options: {
    id: string;
}) => void;
export interface GlobalContext {
    scheduleRevalidate: () => void;
    scheduleDestroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => void;
    scheduleDestroyed: (finalizer: () => void) => void;
    toIterator: (value: unknown) => IteratorDelegate | null;
    toBool: (value: unknown) => boolean;
    getProp: (obj: object, path: string) => unknown;
    setProp: (obj: object, prop: string, value: unknown) => void;
    getPath: (obj: object, path: string) => unknown;
    setPath: (obj: object, prop: string, value: unknown) => void;
    warnIfStyleNotTrusted: (value: unknown) => void;
    assert: (test: unknown, msg: string, options?: {
        id: string;
    }) => asserts test;
    deprecate: (msg: string, test: unknown, options: {
        id: string;
    }) => void;
    FEATURES?: {
        DEFAULT_HELPER_MANAGER?: boolean;
    };
}
export default function setGlobalContext(context: GlobalContext): void;
export declare let assertGlobalContextWasSet: (() => void) | undefined;
export declare let testOverrideGlobalContext: ((context: Partial<GlobalContext> | null) => GlobalContext | null) | undefined;
export {};
//# sourceMappingURL=index.d.ts.map