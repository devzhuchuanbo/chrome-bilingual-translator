interface CacheEntry {
  value: string;
  touchedAt: number;
}

type CacheData = Record<string, CacheEntry>;

const CACHE_KEY = 'translationCacheV1';
const MAX_ENTRIES = 500;

export function textHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function cacheKey(text: string, source: string, target: string): string {
  return `${source}:${target}:${textHash(text)}:${text.length}`;
}

export class TranslationCache {
  private data: CacheData | null = null;

  private async load(): Promise<CacheData> {
    if (this.data) return this.data;
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      this.data = {};
      return this.data;
    }
    const stored = await chrome.storage.local.get(CACHE_KEY);
    this.data = (stored[CACHE_KEY] as CacheData | undefined) ?? {};
    return this.data;
  }

  async get(key: string): Promise<string | undefined> {
    const data = await this.load();
    const entry = data[key];
    if (!entry) return undefined;
    entry.touchedAt = Date.now();
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.load();
    data[key] = { value, touchedAt: Date.now() };

    const keys = Object.keys(data);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((left, right) => data[left]!.touchedAt - data[right]!.touchedAt)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((oldKey) => delete data[oldKey]);
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [CACHE_KEY]: data });
    }
  }
}
