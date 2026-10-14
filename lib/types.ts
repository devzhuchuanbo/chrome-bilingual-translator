export type DisplayMode = 'bilingual' | 'replace';

export interface TranslationStyle {
  color: string;
  fontSize: number;
  spacing: number;
}

export interface Settings {
  targetLanguage: string;
  displayMode: DisplayMode;
  autoTranslateSites: string[];
  style: TranslationStyle;
}

export type TranslationPhase =
  | 'idle'
  | 'detecting'
  | 'waiting-user'
  | 'downloading'
  | 'translating'
  | 'complete'
  | 'stopped'
  | 'error';

export interface TranslationStatus {
  phase: TranslationPhase;
  completed: number;
  total: number;
  sourceLanguage?: string;
  error?: string;
  downloadProgress?: number;
}

export type ContentMessage =
  | { type: 'START_TRANSLATION'; settings: Settings }
  | { type: 'STOP_TRANSLATION' }
  | { type: 'SET_DISPLAY_MODE'; mode: DisplayMode }
  | { type: 'GET_TRANSLATION_STATUS' }
  | { type: 'UPDATE_STYLE'; style: TranslationStyle };

export const DEFAULT_SETTINGS: Settings = {
  targetLanguage: 'zh',
  displayMode: 'bilingual',
  autoTranslateSites: [],
  style: {
    color: '#476582',
    fontSize: 100,
    spacing: 6,
  },
};
