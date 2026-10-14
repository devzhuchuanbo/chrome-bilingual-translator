import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('设置同步存储', () => {
  it('优先读取同步设置', async () => {
    const syncGet = vi.fn().mockResolvedValue({
      translatorSettings: { displayMode: 'replace', targetLanguage: 'zh-Hant' },
    });
    vi.stubGlobal('chrome', {
      storage: {
        sync: { get: syncGet, set: vi.fn() },
        local: { get: vi.fn(), remove: vi.fn() },
      },
    });

    const settings = await getSettings();
    expect(settings.displayMode).toBe('replace');
    expect(settings.targetLanguage).toBe('zh-Hant');
    expect(settings.style).toEqual(DEFAULT_SETTINGS.style);
  });

  it('把旧版本机设置迁移到同步存储', async () => {
    const syncSet = vi.fn().mockResolvedValue(undefined);
    const localRemove = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: syncSet,
        },
        local: {
          get: vi.fn().mockResolvedValue({
            translatorSettings: { displayMode: 'replace', autoTranslateSites: ['https://a.test'] },
          }),
          remove: localRemove,
        },
      },
    });

    const settings = await getSettings();
    expect(settings.displayMode).toBe('replace');
    expect(settings.autoTranslateSites).toEqual(['https://a.test']);
    expect(syncSet).toHaveBeenCalledWith({ translatorSettings: settings });
    expect(localRemove).toHaveBeenCalledWith('translatorSettings');
  });

  it('保存设置时只写入同步存储', async () => {
    const syncSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: {
        sync: { set: syncSet },
      },
    });

    await saveSettings(DEFAULT_SETTINGS);
    expect(syncSet).toHaveBeenCalledWith({ translatorSettings: DEFAULT_SETTINGS });
  });
});
