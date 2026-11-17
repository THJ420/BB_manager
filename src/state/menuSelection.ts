/**
 * Pure selection-mode reducer for the menu grid. Kept outside the component so
 * enter/exit/toggle/select-all/clear behaviour is unit-testable without RN.
 * Sets are never mutated in place; every transition returns fresh state.
 */

export interface MenuSelectionState {
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
}

export type MenuSelectionAction =
  /** Long-press on a card: enter selection mode, optionally selecting that card. */
  | { type: 'ENTER_SELECTION'; itemId?: string }
  /** Cancel/Done, or a filter/branch change: leave selection mode entirely. */
  | { type: 'EXIT_SELECTION' }
  /** Tap on a card while in selection mode. */
  | { type: 'TOGGLE_ITEM'; itemId: string }
  /** "Select all" applies to the CURRENT filter only. */
  | { type: 'SELECT_ALL'; itemIds: readonly string[] }
  /** Empty the selection but stay in selection mode. */
  | { type: 'CLEAR_SELECTION' };

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

export const initialMenuSelectionState: MenuSelectionState = {
  selectionMode: false,
  selectedIds: EMPTY_IDS,
};

export function menuSelectionReducer(
  state: MenuSelectionState,
  action: MenuSelectionAction
): MenuSelectionState {
  switch (action.type) {
    case 'ENTER_SELECTION': {
      const selectedIds = new Set(state.selectedIds);
      if (action.itemId) selectedIds.add(action.itemId);
      return { selectionMode: true, selectedIds };
    }

    case 'EXIT_SELECTION':
      return { selectionMode: false, selectedIds: EMPTY_IDS };

    case 'TOGGLE_ITEM': {
      // A toggle outside selection mode behaves like a long-press entry so the
      // UI can never drop a tap silently.
      if (!state.selectionMode) {
        return { selectionMode: true, selectedIds: new Set([action.itemId]) };
      }
      const selectedIds = new Set(state.selectedIds);
      if (selectedIds.has(action.itemId)) {
        selectedIds.delete(action.itemId);
      } else {
        selectedIds.add(action.itemId);
      }
      // Deselecting the last item keeps the mode alive (the bar shows 0 and
      // disables actions); only Cancel/Done or a filter change exits.
      return { selectionMode: true, selectedIds };
    }

    case 'SELECT_ALL':
      return { selectionMode: true, selectedIds: new Set(action.itemIds) };

    case 'CLEAR_SELECTION':
      return { selectionMode: state.selectionMode, selectedIds: EMPTY_IDS };

    default:
      return state;
  }
}