import { TranslationController } from '../lib/controller';
import type { ContentMessage } from '../lib/types';

const CONTROLLER_KEY = '__localBilingualTranslatorController__';
type TranslatorWindow = Window & { [CONTROLLER_KEY]?: TranslationController };

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  registration: 'runtime',
  runAt: 'document_idle',
  main() {
    const host = window as TranslatorWindow;
    if (host[CONTROLLER_KEY]) return;

    const controller = new TranslationController();
    host[CONTROLLER_KEY] = controller;

    chrome.runtime.onMessage.addListener(
      (
        message: ContentMessage,
        _sender,
        sendResponse: (response?: unknown) => void,
      ) => {
        if (!message?.type) return false;

        if (message.type === 'START_TRANSLATION') {
          void controller.start(message.settings).then(sendResponse);
          return true;
        }
        if (message.type === 'STOP_TRANSLATION') {
          controller.stop();
          sendResponse(controller.getStatus());
          return false;
        }
        if (message.type === 'SET_DISPLAY_MODE') {
          controller.setMode(message.mode);
          sendResponse(controller.getStatus());
          return false;
        }
        if (message.type === 'UPDATE_STYLE') {
          controller.updateStyle(message.style);
          sendResponse(controller.getStatus());
          return false;
        }
        if (message.type === 'GET_TRANSLATION_STATUS') {
          sendResponse(controller.getStatus());
          return false;
        }
        return false;
      },
    );
  },
});
