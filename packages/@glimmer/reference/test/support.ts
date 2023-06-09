
export { tracked } from '@glimmer-workspace/integration-tests';

// export const tracked2 = <This extends object, Value>(
//   value: undefined,
//   context: ClassFieldDecoratorContext<This, Value>
//   // context: ClassAccessorDecoratorContext
// ): void => {
//   let data: TrackedData<This, keyof This>;

//   debugger;

//   context.addInitializer(function (this: This) {
//     Object.defineProperty(this, context.name, {
//       get() {
//         if (data === undefined) {
//           data = trackedData<This, keyof This>(
//             context.name as keyof This,
//             () => context.access.get(this) as This[keyof This]
//           );
//         }

//         return data.getter(this);
//       },
//       set(value: This[keyof This]) {
//         unwrap(data).setter(this, value);
//       },
//     });
//   });
// };

// export function tracked<T extends object, K extends keyof T>(obj: T, key: K): void;
// export function tracked<T extends object, K extends keyof T>(
//   k: { new (...args: any[]): T },
//   key: K
// ): void;
// export function tracked<T extends object, K extends keyof T>(
//   obj: T | { new (...args: unknown[]): T },
//   key: K
// ): void {
//   let target: T;
//   let initializer: (() => T[K]) | undefined;

//   if (typeof obj === 'function') {
//     target = obj.prototype;
//   } else {
//     target = obj;
//     let initialValue = target[key];
//     initializer = () => initialValue;
//   }

//   let { getter, setter } = trackedData<T, K>(key, initializer);

//   Object.defineProperty(target, key, {
//     get() {
//       return getter(this);
//     },
//     set(value) {
//       return setter(this, value);
//     },
//   });
// }
