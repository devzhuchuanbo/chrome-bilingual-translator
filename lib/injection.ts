import type { ContentMessage, TranslationStatus } from './types';

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

export async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  });
}

export async function sendToTab(
  tabId: number,
  message: ContentMessage,
): Promise<TranslationStatus | void> {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, message) as Promise<TranslationStatus | void>;
}
