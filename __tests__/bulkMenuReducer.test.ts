import { appReducer, AppState, initialAppState } from '../src/state/reducer';
import { createSeedMenu } from '../src/lib/seed';
import { MenuItem } from '../src/types';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const AT = '2026-01-02T09:30:00.000Z';

function stateWithMenu(): { state: AppState; menu: MenuItem[] } {
  const menu = createSeedMenu(NOW);
  return {
    state: { ...initialAppState, hydrated: true, menuItems: menu },
    menu,
  };
}

describe('appReducer bulk menu actions', () => {
  it('applies a bulk field patch to every targeted item at once', () => {
    const { state, menu } = stateWithMenu();
    const [first, second] = menu as [MenuItem, MenuItem];

    const next = appReducer(state, {
      type: 'BULK_SET_MENU_FIELDS',
      patches: [
        { itemId: first.id, inStock: false },
        { itemId: second.id, inStock: false },
      ],
      at: AT,
    });

    expect(next.menuItems.find((item) => item.id === first.id)?.inStock).toBe(false);
    expect(next.menuItems.find((item) => item.id === second.id)?.inStock).toBe(false);
    expect(next.menuItems.find((item) => item.id === first.id)?.updatedAt).toBe(AT);
    // Untargeted items keep their previous values and timestamps.
    const untouched = next.menuItems[2] as MenuItem;
    expect(untouched.inStock).toBe((menu[2] as MenuItem).inStock);
    expect(untouched.updatedAt).toBe((menu[2] as MenuItem).updatedAt);
  });

  it('only writes the fields present in each patch', () => {
    const { state, menu } = stateWithMenu();
    const target = menu[0] as MenuItem;

    const next = appReducer(state, {
      type: 'BULK_SET_MENU_FIELDS',
      patches: [{ itemId: target.id, isVisible: false }],
      at: AT,
    });

    const updated = next.menuItems.find((item) => item.id === target.id) as MenuItem;
    expect(updated.isVisible).toBe(false);
    expect(updated.price).toBe(target.price);
    expect(updated.inStock).toBe(target.inStock);
    expect(updated.name).toBe(target.name);
  });

  it('supports mixed price, stock and visibility patches in one action', () => {
    const { state, menu } = stateWithMenu();
    const [first, second] = menu as [MenuItem, MenuItem];

    const next = appReducer(state, {
      type: 'BULK_SET_MENU_FIELDS',
      patches: [
        { itemId: first.id, price: 15.5, inStock: true },
        { itemId: second.id, isVisible: false },
      ],
      at: AT,
    });

    const a = next.menuItems.find((item) => item.id === first.id) as MenuItem;
    const b = next.menuItems.find((item) => item.id === second.id) as MenuItem;
    expect(a.price).toBe(15.5);
    expect(a.inStock).toBe(true);
    expect(a.isVisible).toBe(first.isVisible);
    expect(b.isVisible).toBe(false);
    expect(b.price).toBe(second.price);
  });

  it('ignores patches for unknown ids', () => {
    const { state } = stateWithMenu();
    const next = appReducer(state, {
      type: 'BULK_SET_MENU_FIELDS',
      patches: [{ itemId: 'does_not_exist', price: 1 }],
      at: AT,
    });
    expect(next.menuItems).toEqual(state.menuItems);
  });

  it('removes every targeted item on bulk delete and keeps the rest', () => {
    const { state, menu } = stateWithMenu();
    const [first, second] = menu as [MenuItem, MenuItem];

    const next = appReducer(state, {
      type: 'BULK_REMOVE_MENU_ITEMS',
      itemIds: [first.id, second.id],
    });

    expect(next.menuItems).toHaveLength(menu.length - 2);
    expect(next.menuItems.some((item) => item.id === first.id)).toBe(false);
    expect(next.menuItems.some((item) => item.id === second.id)).toBe(false);
    expect(next.menuItems[0]?.id).toBe(menu[2]?.id);
  });

  it('bulk delete with unknown ids is a no-op', () => {
    const { state } = stateWithMenu();
    const next = appReducer(state, {
      type: 'BULK_REMOVE_MENU_ITEMS',
      itemIds: ['ghost_1', 'ghost_2'],
    });
    expect(next.menuItems).toEqual(state.menuItems);
  });
});