import {
  categoriesFromMenu,
  menuCategoryOptions,
  mergeCategoryNames,
} from '../src/lib/domain';
import { createSeedMenu } from '../src/lib/seed';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');

describe('dynamic menu categories', () => {
  it('derives categories from the actual menu instead of a hardcoded list', () => {
    const menu = createSeedMenu(NOW);
    const derived = categoriesFromMenu(menu);

    // The seed only uses these three; "Desserts" (a former hardcoded chip)
    // must not appear when nothing is in it.
    expect(derived).toContain('Burgers');
    expect(derived).toContain('Sides');
    expect(derived).toContain('Beverages');
    expect(derived).not.toContain('Desserts');
  });

  it('picks up a brand-new category saved on an item', () => {
    const menu = createSeedMenu(NOW);
    const withNew = [
      ...menu,
      { ...menu[0]!, id: 'm_new', name: 'Mango Lassi', category: 'Seasonal Specials' },
    ];

    const labels = menuCategoryOptions(withNew).map((option) => option.label);

    expect(labels).toContain('Seasonal Specials');
    expect(labels[0]).toBe('All');
  });

  it('merges upstream categories with local ones, case-insensitively', () => {
    const merged = mergeCategoryNames(
      ['Burgers', 'Sides'],
      ['burgers', '  New Category  ', '', 'Mains']
    );

    expect(merged).toEqual(['Burgers', 'Mains', 'New Category', 'Sides']);
  });

  it('counts items per dynamic category', () => {
    const menu = createSeedMenu(NOW);
    const options = menuCategoryOptions(menu, ['Desserts']);
    const burgers = options.find((option) => option.label === 'Burgers');
    const desserts = options.find((option) => option.label === 'Desserts');

    expect(burgers?.count).toBe(3);
    expect(desserts?.count).toBe(0);
    expect(options.find((option) => option.label === 'All')?.count).toBe(menu.length);
  });
});
