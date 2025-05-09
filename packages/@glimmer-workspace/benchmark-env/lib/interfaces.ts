import type { Dict, SerializedTemplateWithLazyBlock, SimpleElement } from '@glimmer/interfaces';

/**
 * This abstracts a tracked root.
 */
export interface Cell<T> {
  get(): T;
  set(value: T): void;
}

export type ComponentArgs = Readonly<Dict>;

export interface Benchmark {
  /**
   * Register a template only component
   * @param name
   * @param template
   */
  templateOnlyComponent(name: string, template: SerializedTemplateWithLazyBlock): void;

  /**
   * Register a basic component
   * @param name
   * @param template
   * @param component
   */
  basicComponent<TComponent extends object = object, Args extends ComponentArgs = ComponentArgs>(
    name: string,
    template: SerializedTemplateWithLazyBlock,
    component: new (args: Args) => TComponent
  ): void;

  /**
   * Create the benchmark
   * @param entry the name of the entry component
   * @param args the named args to the component
   * @param element the target element to append to
   * @param isInteractive whether we are in SSR mode
   */
  render(
    entry: string,
    args: Dict,
    element: SimpleElement | HTMLElement,
    isInteractive?: boolean
  ): Promise<UpdateBenchmark>;
}

/**
 * Update the benchmark.
 * @param name - the name of the measure. The marks used will be `${measure}Start` and `${measure}End`.
 * @param doUpdate - a callback that will do the mutation, the measure will be from before the callback until it is rendered.
 */
export type UpdateBenchmark = (name: string, doUpdate: () => void) => Promise<void>;
