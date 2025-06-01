import { getMainCategory } from '@/types/inventory';
import type { SubCategory, Category } from '@/types/inventory';

describe('getMainCategory', () => {
  const coolerSubs: SubCategory[] = ['fruit' as SubCategory, 'vegetables' as SubCategory, 'juices' as SubCategory, 'dairy' as SubCategory];
  coolerSubs.forEach((sub) => {
    it(`maps ${sub} to cooler`, () => {
      expect(getMainCategory(sub)).toBe('cooler');
    });
  });

  const freezerSubs: SubCategory[] = [
    'meats' as SubCategory, 'cooked meats' as SubCategory, 'frozen vegetables' as SubCategory,
    'bread' as SubCategory, 'desserts' as SubCategory, 'soups' as SubCategory, 'dressings' as SubCategory,
  ];
  freezerSubs.forEach((sub) => {
    it(`maps ${sub} to freezer`, () => {
      expect(getMainCategory(sub)).toBe('freezer');
    });
  });

  it('maps dry to dry', () => {
    expect(getMainCategory('dry' as SubCategory)).toBe('dry');
  });

  it('maps canned to canned', () => {
    expect(getMainCategory('canned' as SubCategory)).toBe('canned');
  });

  it('maps other to other', () => {
    expect(getMainCategory('other' as SubCategory)).toBe('other');
  });
});