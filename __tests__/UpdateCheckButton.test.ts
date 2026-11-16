import React from 'react';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
}));
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}), { virtual: true });
jest.mock('../src/state/AppProvider', () => ({ useApp: jest.fn() }));
jest.mock('../src/components/ActionButton', () => ({ ActionButton: 'ActionButton' }));
jest.mock('../src/components/DialogModal', () => ({ DialogModal: 'DialogModal' }));
jest.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.4.1' } }, __esModule: true }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-intent-launcher', () => ({}));
jest.mock('../src/db/sqlite', () => ({}));

import { UpdateCheckButton } from '../src/components/UpdateCheckButton';
import { useApp } from '../src/state/AppProvider';
import type { UpdateCheck } from '../src/services/updater';

// Handler-level tests with mocked hooks, not native rendering/device tests.
describe('manual update feedback', () => {
  const checkForAppUpdate = jest.fn();
  const setResult = jest.fn();
  const upToDate: UpdateCheck = {
    available: false,
    currentVersion: '1.4.1',
    release: null,
    error: null,
  };

  function button() {
    const tree = UpdateCheckButton();
    return tree.props.children[0].props.children[0] as React.ReactElement<{
      onPress: () => void;
      disabled: boolean;
    }>;
  }

  async function pressCheck() {
    button().props.onPress();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkForAppUpdate.mockReset().mockResolvedValue(upToDate);
    jest.mocked(React.useState).mockReturnValue([null, setResult]);
    (useApp as jest.Mock).mockReturnValue({ checkForAppUpdate, checkingAppUpdate: false });
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the exact up-to-date text without a version suffix', async () => {
    await pressCheck();
    expect(checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(setResult).toHaveBeenLastCalledWith({
      title: 'Up to Date',
      message: 'You are already using the latest version of the app.',
    });
  });

  it.each(['HTTP 403 from GitHub', 'HTTP 500', 'offline', 'Network request failed'])(
    'never displays technical error details: %s', async (error) => {
      checkForAppUpdate.mockResolvedValue({ ...upToDate, error });
      await pressCheck();
      expect(setResult).toHaveBeenLastCalledWith({
        title: 'Update Check Failed',
        message: 'Sorry, server is busy now, please try after a few minutes.',
      });
    }
  );

  it('also uses the friendly message for an unexpected rejection', async () => {
    checkForAppUpdate.mockRejectedValue(new Error('HTTP 403'));
    await pressCheck();
    expect(setResult).toHaveBeenLastCalledWith({
      title: 'Update Check Failed',
      message: 'Sorry, server is busy now, please try after a few minutes.',
    });
  });

  it('delegates an available update to the provider without adding a result dialog', async () => {
    checkForAppUpdate.mockResolvedValue({
      ...upToDate,
      available: true,
      release: { version: '1.4.2' },
    });
    await pressCheck();
    expect(checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(setResult.mock.calls).toEqual([[null]]);
  });

  it('allows a manual request to await a background check and receive feedback', async () => {
    let finish!: (result: UpdateCheck) => void;
    checkForAppUpdate.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    expect(button().props.disabled).toBe(false);
    await pressCheck();
    expect(checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(setResult.mock.calls).toEqual([[null]]);
    finish(upToDate);
    await Promise.resolve();
    expect(setResult).toHaveBeenLastCalledWith({
      title: 'Up to Date',
      message: 'You are already using the latest version of the app.',
    });
  });

  it('disables repeat taps while a manual check is pending', async () => {
    (useApp as jest.Mock).mockReturnValue({ checkForAppUpdate, checkingAppUpdate: true });
    expect(button().props.disabled).toBe(true);
    await pressCheck();
    expect(checkForAppUpdate).not.toHaveBeenCalled();
  });
});
