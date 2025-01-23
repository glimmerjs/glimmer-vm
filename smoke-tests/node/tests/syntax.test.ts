import { preprocess } from '@glimmer/syntax';
import { describe, it, expect } from 'vitest';

describe('@glimmer/syntax', () => {
  it('process()', () => {
    expect(preprocess('<h1></h1>')).toMatchInlineSnapshot();
  });
});
