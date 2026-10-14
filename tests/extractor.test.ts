import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectTextBlocks,
  isMostlyTargetLanguage,
  normalizeText,
  pageSample,
} from '../lib/dom/extractor';

const fixture = readFileSync(
  join(process.cwd(), 'tests/fixtures/article.html'),
  'utf8',
);

describe('正文提取', () => {
  it('保留有效文本并跳过代码、表单、隐藏内容和中文', () => {
    document.body.innerHTML = fixture;
    const blocks = collectTextBlocks(document, 'zh');
    const texts = blocks.map((element) => normalizeText(element.textContent ?? ''));

    expect(texts).toContain('A practical guide to local translation');
    expect(texts).toContain('Translation should preserve meaning and context.');
    expect(texts).toContain('Nested paragraphs must not be translated twice.');
    expect(texts).toContain('Simple list items are candidates.');
    expect(texts).not.toContain('const language = "en";');
    expect(texts).not.toContain('This paragraph is hidden.');
    expect(texts).not.toContain('This paragraph opts out.');
    expect(texts).not.toContain('这是已经是中文的内容。');
    expect(texts.filter((text) => text.includes('Nested paragraphs')).length).toBe(1);
  });

  it('生成有长度上限的语言识别样本', () => {
    document.body.innerHTML = fixture;
    const sample = pageSample(collectTextBlocks(document), 60);
    expect(sample.length).toBeLessThanOrEqual(60);
    expect(sample).toContain('A practical guide');
  });

  it('正确判断主要由中文组成的文本', () => {
    expect(isMostlyTargetLanguage('你好世界，AI', 'zh')).toBe(true);
    expect(isMostlyTargetLanguage('A guide to translation', 'zh')).toBe(false);
    expect(isMostlyTargetLanguage('你好', 'en')).toBe(false);
  });
});
