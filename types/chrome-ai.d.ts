interface AIAvailabilityOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

type AIAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface AIModelMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: Event & { loaded: number }) => void,
  ): void;
}

interface TranslatorInstance {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

interface TranslatorFactory {
  availability(options: AIAvailabilityOptions): Promise<AIAvailability>;
  create(
    options: AIAvailabilityOptions & {
      monitor?: (monitor: AIModelMonitor) => void;
      signal?: AbortSignal;
    },
  ): Promise<TranslatorInstance>;
}

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface LanguageDetectorInstance {
  detect(text: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult[]>;
  destroy(): void;
}

interface LanguageDetectorFactory {
  availability(): Promise<AIAvailability>;
  create(options?: {
    monitor?: (monitor: AIModelMonitor) => void;
    signal?: AbortSignal;
  }): Promise<LanguageDetectorInstance>;
}

declare const Translator: TranslatorFactory;
declare const LanguageDetector: LanguageDetectorFactory;
