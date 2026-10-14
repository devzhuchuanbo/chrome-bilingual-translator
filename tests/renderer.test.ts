import { describe, expect, it } from 'vitest';
import { TranslationRenderer } from '../lib/render/renderer';
import { DEFAULT_SETTINGS } from '../lib/types';

describe('译文渲染', () => {
  it('在双语和替换模式间无损切换', () => {
    document.body.innerHTML = '<article><p id="source">Original <strong>text</strong>.</p></article>';
    const source = document.querySelector('#source') as HTMLElement;
    const originalHtml = source.innerHTML;
    const renderer = new TranslationRenderer('bilingual', DEFAULT_SETTINGS.style);

    renderer.render(source, '翻译文本。');
    const translation = source.nextElementSibling as HTMLElement;
    expect(translation.textContent).toBe('翻译文本。');
    expect(source.classList.contains('local-translator-source-hidden')).toBe(false);
    expect(source.innerHTML).toBe(originalHtml);

    renderer.setMode('replace');
    expect(source.classList.contains('local-translator-source-hidden')).toBe(true);
    expect(source.nextElementSibling?.textContent).toBe('翻译文本。');

    renderer.setMode('bilingual');
    expect(source.classList.contains('local-translator-source-hidden')).toBe(false);
    expect(source.innerHTML).toBe(originalHtml);

    renderer.clear();
    expect(source.className).toBe('');
    expect(source.innerHTML).toBe(originalHtml);
    expect(document.querySelector('[data-local-translator="translation"]')).toBeNull();
  });

  it('表格双语译文留在单元格中，替换模式保持表格单元格结构', () => {
    document.body.innerHTML = '<table><tbody><tr><td id="cell">Price</td></tr></tbody></table>';
    const source = document.querySelector('#cell') as HTMLElement;
    const renderer = new TranslationRenderer('bilingual', DEFAULT_SETTINGS.style);

    renderer.render(source, '价格');
    expect(source.querySelector('[data-local-translator="translation"]')?.textContent).toBe('价格');

    renderer.setMode('replace');
    expect(source.nextElementSibling?.tagName).toBe('TD');
    expect(source.nextElementSibling?.textContent).toBe('价格');

    renderer.clear();
    expect(source.textContent).toBe('Price');
    expect(source.nextElementSibling).toBeNull();
  });
});
