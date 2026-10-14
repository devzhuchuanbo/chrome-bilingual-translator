import { cacheKey, TranslationCache } from './cache';

export class UnsupportedTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedTranslationError';
  }
}

export type DownloadProgressHandler = (progress: number) => void;

const MAX_CHUNK_LENGTH = 3000;

export function normalizeLanguage(code: string): string {
  const normalized = code.trim().replace('_', '-').toLowerCase();
  if (normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-hant') {
    return 'zh-Hant';
  }
  if (normalized.startsWith('zh')) return 'zh';
  return normalized.split('-')[0] || 'en';
}

export function splitText(text: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const sentences = Array.from(segmenter.segment(text), (item) => item.segment);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxLength) {
      chunks.push(current);
      current = '';
    }
    if (sentence.length > maxLength) {
      for (let offset = 0; offset < sentence.length; offset += maxLength) {
        chunks.push(sentence.slice(offset, offset + maxLength));
      }
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export class ChromeTranslationService {
  private translator?: TranslatorInstance;
  private detector?: LanguageDetectorInstance;
  private pair?: string;
  private readonly cache = new TranslationCache();

  isSupported(): boolean {
    return 'Translator' in globalThis && 'LanguageDetector' in globalThis;
  }

  async detectLanguage(text: string, fallback = 'en', signal?: AbortSignal): Promise<string> {
    if (!this.isSupported()) {
      throw new UnsupportedTranslationError(
        '此浏览器不支持内置翻译。请使用桌面版 Chrome 138 或更高版本。',
      );
    }

    try {
      const availability = await LanguageDetector.availability();
      if (availability === 'unavailable') return normalizeLanguage(fallback);
      this.detector ??= await LanguageDetector.create({ signal });
      const results = await this.detector.detect(text, { signal });
      const best = results.find((result) => result.confidence >= 0.4) ?? results[0];
      return normalizeLanguage(best?.detectedLanguage ?? fallback);
    } catch (error) {
      if (signal?.aborted) throw error;
      return normalizeLanguage(fallback);
    }
  }

  async prepare(
    sourceLanguage: string,
    targetLanguage: string,
    onProgress?: DownloadProgressHandler,
    signal?: AbortSignal,
    availabilityAlreadyChecked = false,
  ): Promise<void> {
    const source = normalizeLanguage(sourceLanguage);
    const target = normalizeLanguage(targetLanguage);
    const nextPair = `${source}:${target}`;
    if (this.translator && this.pair === nextPair) return;

    this.translator?.destroy();
    this.translator = undefined;

    const availability = availabilityAlreadyChecked
      ? 'downloadable'
      : await this.getAvailability(source, target);
    if (availability === 'unavailable') {
      throw new UnsupportedTranslationError(`Chrome 暂不支持 ${source} → ${target} 翻译。`);
    }

    try {
      this.translator = await Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        signal,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            onProgress?.(Math.round(event.loaded * 100));
          });
        },
      });
      this.pair = nextPair;
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (/user gesture|user activation|unable to create translator/i.test(message)) {
        throw new UnsupportedTranslationError(
          'Chrome 无法创建该语言包。请确认已在网页内点击下载按钮，并检查 Chrome 是否支持此语言对。',
        );
      }
      throw error;
    }
  }

  async getAvailability(
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<AIAvailability> {
    const source = normalizeLanguage(sourceLanguage);
    const target = normalizeLanguage(targetLanguage);
    return Translator.availability({ sourceLanguage: source, targetLanguage: target });
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!this.translator) throw new Error('翻译模型尚未准备完成。');
    const key = cacheKey(text, sourceLanguage, targetLanguage);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const chunks = splitText(text);
    const translated: string[] = [];
    for (const chunk of chunks) {
      translated.push(await this.translator.translate(chunk, { signal }));
    }
    const result = translated.join('');
    await this.cache.set(key, result);
    return result;
  }

  destroy(): void {
    this.translator?.destroy();
    this.detector?.destroy();
    this.translator = undefined;
    this.detector = undefined;
    this.pair = undefined;
  }
}
