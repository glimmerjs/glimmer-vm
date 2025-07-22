import type { ComponentArgument, CurlyArgument } from './objects/args';

/**
 * Type guard to check if an argument is a ComponentArgument.
 * ComponentArguments have AttrValueNode values (InterpolatePartNode | InterpolateExpression)
 * while CurlyArguments have ExpressionValueNode values.
 */
export function isComponentArgument(
  arg: CurlyArgument | ComponentArgument
): arg is ComponentArgument {
  // Check if the value is an AttrValueNode (has type 'InterpolatePart' or 'Interpolate')
  const value = arg.value;
  return value.type === 'Interpolate';
}
