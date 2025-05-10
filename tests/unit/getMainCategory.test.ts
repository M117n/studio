import { getMainCategory } from '@/types/inventory';
import type { SubCategory, Category } from '@/types/inventory';

describe('getMainCategory', () => {
  const coolerSubs: SubCategory[] = ['fruit', 'vegetables', 'juices', 'dairy'];
  coolerSubs.forEach((sub) => {
    it(`maps ${sub} to cooler`, () => {
      expect(getMainCategory(sub)).toBe('cooler');
    });
  });

  const freezerSubs: SubCategory[] = [
    'meats', 'cooked meats', 'frozen vegetables',
    'bread', 'desserts', 'soups', 'dressings',
  ];
  freezerSubs.forEach((sub) => {
    it(`maps ${sub} to freezer`, () => {
      expect(getMainCategory(sub)).toBe('freezer');
    });
  });

  it('maps dry to dry', () => {
    expect(getMainCategory('dry')).toBe('dry');
  });

  it('maps canned to canned', () => {
    expect(getMainCategory('canned')).toBe('canned');
  });

  it('maps other to other', () => {
    expect(getMainCategory('other')).toBe('other');
  });
});