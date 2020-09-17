import { SourceLocation } from '../source/location';

export interface GlimmerSyntaxError extends Error {
  location: SourceLocation | null;
  constructor: SyntaxErrorConstructor;
}

export interface SyntaxErrorConstructor {
  new (message: string, location: SourceLocation | null): GlimmerSyntaxError;
  readonly prototype: GlimmerSyntaxError;
}

/**
 * Subclass of `Error` with additional information
 * about location of incorrect markup.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const GlimmerSyntaxError: SyntaxErrorConstructor = (function () {
  SyntaxError.prototype = Object.create(Error.prototype);
  SyntaxError.prototype.constructor = SyntaxError;

  function SyntaxError(this: GlimmerSyntaxError, message: string, location: SourceLocation | null) {
    let error = Error.call(this, message);

    this.message = message;
    this.stack = error.stack;
    this.location = location;
  }

  return SyntaxError as any;
})();
