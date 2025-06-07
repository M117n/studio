import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names without conflicts', () => {
    expect(cn('p-4', 'pt-2')).toBe('p-4 pt-2');
  });

  it('merges conflicting class names, using the last one', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles conditional object values', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('ignores undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('merges arrays of class names', () => {
    expect(cn(['foo', null], ['bar'], { baz: true })).toBe('foo bar baz');
  });
});