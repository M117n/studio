import { convertUnits, factors } from '@/lib/unitConversion';
import type { Unit } from '@/types/inventory';

describe('convertUnits', () => {
  it('returns the same value for identical units', () => {
    expect(convertUnits(42, 'kg', 'kg')).toBe(42);
    expect(convertUnits(3.14, 'L', 'L')).toBe(3.14);
  });

  it('returns null when conversion is not available', () => {
    // No direct conversion defined between 'kg' and 'L'
    expect(convertUnits(1, 'kg', 'L')).toBeNull();
    // Never‑convertible units
    expect(convertUnits(1, "case", "kg")).toBeNull();
    expect(convertUnits(1, "bag", "bottle")).toBeNull();
  });

  it("leaves value unchanged for identical never‑convertible units", () => {
    expect(convertUnits(7, "case", "case")).toBe(7);
  });

  describe('conversion factors', () => {
    Object.entries(factors).forEach(([from, mapping]) => {
      if (!mapping) return;
      Object.entries(mapping).forEach(([to, factor]) => {
        it(`converts 1 ${from} to ${to}`, () => {
          const result = convertUnits(1, from as Unit, to as Unit);
          expect(result).toBeCloseTo(factor as number, 5);
        });
      });
    });
  });
});