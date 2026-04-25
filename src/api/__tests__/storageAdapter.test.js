import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { Preferences } from '@capacitor/preferences';
import { storageAdapter } from '../storageAdapter';

describe('storageAdapter native fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.Capacitor = { isNativePlatform: () => true };
  });

  it('returns local fallback data when Preferences.get fails on native', async () => {
    localStorage.setItem('gamezone_db', JSON.stringify({
      Console: [{ id: 'console-1', name: 'PS5 #1' }],
    }));
    Preferences.get.mockRejectedValueOnce(new Error('plugin missing'));

    const consoles = await storageAdapter.entities.Console.list('test-owner');

    expect(consoles).toEqual([{ id: 'console-1', name: 'PS5 #1' }]);
    expect(Preferences.get).toHaveBeenCalledWith({ key: 'gamezone_db' });
  });

  it('writes to localStorage when Preferences.set fails on native', async () => {
    Preferences.get.mockResolvedValueOnce({ value: null });
    Preferences.set.mockRejectedValueOnce(new Error('plugin missing'));

    const created = await storageAdapter.entities.Console.create('test-owner', { name: 'PS5 #2', status: 'available' });
    const persisted = JSON.parse(localStorage.getItem('gamezone_db'));

    expect(created.name).toBe('PS5 #2');
    expect(persisted.Console).toHaveLength(1);
    expect(persisted.Console[0].name).toBe('PS5 #2');
    expect(Preferences.set).toHaveBeenCalled();
  });
});
