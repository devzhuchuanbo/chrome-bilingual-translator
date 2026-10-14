import { DEFAULT_SETTINGS, type Settings } from './types';

const SETTINGS_KEY = 'translatorSettings';

export async function getSettings(): Promise<Settings> {
  const syncedResult = await chrome.storage.sync.get(SETTINGS_KEY);
  let saved = syncedResult[SETTINGS_KEY] as Partial<Settings> | undefined;

  if (!saved) {
    const localResult = await chrome.storage.local.get(SETTINGS_KEY);
    saved = localResult[SETTINGS_KEY] as Partial<Settings> | undefined;
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    autoTranslateSites: saved?.autoTranslateSites ?? [],
    style: { ...DEFAULT_SETTINGS.style, ...saved?.style },
  };

  if (!syncedResult[SETTINGS_KEY] && saved) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    await chrome.storage.local.remove(SETTINGS_KEY);
  }

  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export function normalizeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function originPattern(origin: string): string {
  return `${origin}/*`;
}
