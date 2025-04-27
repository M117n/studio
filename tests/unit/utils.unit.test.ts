import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names without conflicts', () => {
    expect(cn('p-4', 'pt-2')).toBe('p-4 pt-2');
  });

  it('merges conflicting class names, using the last one', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});