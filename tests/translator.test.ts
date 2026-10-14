import { describe, expect, it } from 'vitest';
import { cacheKey, textHash } from '../lib/translator/cache';
import { normalizeLanguage, splitText } from '../lib/translator/chrome';

describe('翻译工具', () => {
  it('规范化 Chrome 翻译所需语言代码', () => {
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('zh-CN')).toBe('zh');
    expect(normalizeLanguage('zh-TW')).toBe('zh-Hant');
  });

  it('按句子拆分长文本且不丢失内容', () => {
    const text = 'First sentence. Second sentence is longer. Third sentence.';
    const chunks = splitText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 25)).toBe(true);
  });

  it('生成稳定且区分语言对的缓存键', () => {
    expect(textHash('same')).toBe(textHash('same'));
    expect(cacheKey('same', 'en', 'zh')).not.toBe(cacheKey('same', 'ja', 'zh'));
  });
});
