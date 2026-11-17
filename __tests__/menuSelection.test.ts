import {
  initialMenuSelectionState,
  menuSelectionReducer,
  MenuSelectionState,
} from '../src/state/menuSelection';

const ids = (state: MenuSelectionState): string[] => [...state.selectedIds].sort();

describe('menuSelectionReducer', () => {
  it('starts outside selection mode with an empty selection', () => {
    expect(initialMenuSelectionState.selectionMode).toBe(false);
    expect(initialMenuSelectionState.selectedIds.size).toBe(0);
  });

  it('enters selection mode on long-press and selects the pressed card', () => {
    const next = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
      itemId: 'm_01',
    });
    expect(next.selectionMode).toBe(true);
    expect(ids(next)).toEqual(['m_01']);
  });

  it('can enter selection mode without preselecting a card', () => {
    const next = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
    });
    expect(next.selectionMode).toBe(true);
    expect(next.selectedIds.size).toBe(0);
  });

  it('toggles cards on and off while in selection mode', () => {
    let state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
      itemId: 'm_01',
    });
    state = menuSelectionReducer(state, { type: 'TOGGLE_ITEM', itemId: 'm_02' });
    expect(ids(state)).toEqual(['m_01', 'm_02']);
    state = menuSelectionReducer(state, { type: 'TOGGLE_ITEM', itemId: 'm_01' });
    expect(ids(state)).toEqual(['m_02']);
    expect(state.selectionMode).toBe(true);
  });

  it('keeps selection mode alive after deselecting the last card', () => {
    let state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
      itemId: 'm_01',
    });
    state = menuSelectionReducer(state, { type: 'TOGGLE_ITEM', itemId: 'm_01' });
    expect(state.selectionMode).toBe(true);
    expect(state.selectedIds.size).toBe(0);
  });

  it('treats a toggle outside selection mode as an entry', () => {
    const next = menuSelectionReducer(initialMenuSelectionState, {
      type: 'TOGGLE_ITEM',
      itemId: 'm_03',
    });
    expect(next.selectionMode).toBe(true);
    expect(ids(next)).toEqual(['m_03']);
  });

  it('select-all replaces the selection with the current filter ids', () => {
    let state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
      itemId: 'm_01',
    });
    state = menuSelectionReducer(state, {
      type: 'SELECT_ALL',
      itemIds: ['m_02', 'm_03', 'm_04'],
    });
    expect(state.selectionMode).toBe(true);
    expect(ids(state)).toEqual(['m_02', 'm_03', 'm_04']);
  });

  it('select-all deduplicates ids', () => {
    const state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'SELECT_ALL',
      itemIds: ['m_01', 'm_01', 'm_02'],
    });
    expect(ids(state)).toEqual(['m_01', 'm_02']);
  });

  it('clear empties the selection but stays in selection mode', () => {
    let state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'SELECT_ALL',
      itemIds: ['m_01', 'm_02'],
    });
    state = menuSelectionReducer(state, { type: 'CLEAR_SELECTION' });
    expect(state.selectionMode).toBe(true);
    expect(state.selectedIds.size).toBe(0);
  });

  it('exit leaves selection mode and drops every id', () => {
    let state = menuSelectionReducer(initialMenuSelectionState, {
      type: 'SELECT_ALL',
      itemIds: ['m_01', 'm_02'],
    });
    state = menuSelectionReducer(state, { type: 'EXIT_SELECTION' });
    expect(state.selectionMode).toBe(false);
    expect(state.selectedIds.size).toBe(0);
  });

  it('never mutates the previous state', () => {
    const start = menuSelectionReducer(initialMenuSelectionState, {
      type: 'ENTER_SELECTION',
      itemId: 'm_01',
    });
    const snapshot = ids(start);
    menuSelectionReducer(start, { type: 'TOGGLE_ITEM', itemId: 'm_02' });
    menuSelectionReducer(start, { type: 'SELECT_ALL', itemIds: ['m_09'] });
    menuSelectionReducer(start, { type: 'EXIT_SELECTION' });
    expect(ids(start)).toEqual(snapshot);
    expect(start.selectionMode).toBe(true);
  });
});