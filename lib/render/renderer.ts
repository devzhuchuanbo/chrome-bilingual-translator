import type { DisplayMode, TranslationStyle } from '../types';

interface RenderRecord {
  source: HTMLElement;
  translation: HTMLElement;
  text: string;
}

const STYLE_ID = 'local-translator-styles';
const HIDDEN_CLASS = 'local-translator-source-hidden';
const TRANSLATION_CLASS = 'local-translator-result';

function isTableCell(element: HTMLElement): boolean {
  return element.tagName === 'TD' || element.tagName === 'TH';
}

export class TranslationRenderer {
  private readonly records = new Map<HTMLElement, RenderRecord>();
  private mode: DisplayMode;
  private style: TranslationStyle;

  constructor(mode: DisplayMode, style: TranslationStyle) {
    this.mode = mode;
    this.style = style;
    this.ensureStyles();
  }

  has(source: HTMLElement): boolean {
    return this.records.has(source);
  }

  render(source: HTMLElement, text: string): void {
    const existing = this.records.get(source);
    if (existing) {
      existing.text = text;
      existing.translation.textContent = text;
      return;
    }

    const translation = this.createNode(source, text);
    const record = { source, translation, text };
    this.records.set(source, record);
    this.place(record);
  }

  setMode(mode: DisplayMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const record of this.records.values()) {
      record.source.classList.remove(HIDDEN_CLASS);
      if (isTableCell(record.source)) {
        record.translation.remove();
        record.translation = this.createNode(record.source, record.text);
      }
      this.place(record);
    }
  }

  updateStyle(style: TranslationStyle): void {
    this.style = style;
    for (const record of this.records.values()) this.applyStyle(record);
  }

  removeDisconnected(): void {
    for (const [source, record] of this.records) {
      if (!source.isConnected) {
        record.translation.remove();
        this.records.delete(source);
      }
    }
  }

  clear(): void {
    for (const record of this.records.values()) {
      record.source.classList.remove(HIDDEN_CLASS);
      record.translation.remove();
    }
    this.records.clear();
    document.getElementById(STYLE_ID)?.remove();
  }

  private createNode(source: HTMLElement, text: string): HTMLElement {
    const useCellTag = isTableCell(source) && this.mode === 'replace';
    const tagName = useCellTag ? source.tagName.toLowerCase() : isTableCell(source) ? 'div' : source.tagName.toLowerCase();
    const node = source.ownerDocument.createElement(tagName);
    node.className = TRANSLATION_CLASS;
    node.dataset.localTranslator = 'translation';
    node.lang = 'zh-CN';
    node.textContent = text;
    this.applyStyle({ source, translation: node, text });
    return node;
  }

  private place(record: RenderRecord): void {
    const { source, translation } = record;
    if (this.mode === 'replace') {
      source.classList.add(HIDDEN_CLASS);
      source.after(translation);
    } else {
      source.classList.remove(HIDDEN_CLASS);
      if (isTableCell(source)) source.append(translation);
      else source.after(translation);
    }
    this.applyStyle(record);
  }

  private applyStyle(record: RenderRecord): void {
    const computedSize = Number.parseFloat(
      record.source.ownerDocument.defaultView?.getComputedStyle(record.source).fontSize ?? '16',
    );
    const node = record.translation;
    node.style.setProperty('color', this.style.color, 'important');
    node.style.setProperty(
      'font-size',
      `${(Number.isFinite(computedSize) ? computedSize : 16) * (this.style.fontSize / 100)}px`,
      'important',
    );
    node.style.setProperty('margin-top', this.mode === 'bilingual' ? `${this.style.spacing}px` : '0');
  }

  private ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.dataset.localTranslator = 'style';
    style.textContent = `
      .${TRANSLATION_CLASS} {
        opacity: 0.94 !important;
        font-family: inherit !important;
        font-style: normal !important;
        text-decoration: none !important;
      }
      .${HIDDEN_CLASS} {
        display: none !important;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  }
}
