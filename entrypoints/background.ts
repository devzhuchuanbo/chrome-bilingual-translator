import { ensureContentScript } from '../lib/injection';
import { getSettings, normalizeOrigin } from '../lib/storage';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async () => {
    await getSettings();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    void autoTranslate(tabId, tab.url);
  });
});

async function autoTranslate(tabId: number, url: string): Promise<void> {
  const origin = normalizeOrigin(url);
  if (!origin) return;

  const settings = await getSettings();
  if (!settings.autoTranslateSites.includes(origin)) return;

  const allowed = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (!allowed) return;

  try {
    await ensureContentScript(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'START_TRANSLATION', settings });
  } catch (error) {
    console.warn('[本地双语翻译] 自动翻译启动失败', error);
  }
}
