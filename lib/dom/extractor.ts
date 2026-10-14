const BLOCK_SELECTOR =
  'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt';

const EXCLUDED_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'pre',
  'code',
  'kbd',
  'samp',
  'textarea',
  'input',
  'select',
  'option',
  'button',
  '[contenteditable="true"]',
  '[translate="no"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '[data-local-translator]',
  '.notranslate',
].join(',');

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isMostlyTargetLanguage(text: string, targetLanguage: string): boolean {
  if (!targetLanguage.toLowerCase().startsWith('zh')) return false;
  const meaningful = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!meaningful) return true;
  const chinese = meaningful.match(/\p{Script=Han}/gu)?.length ?? 0;
  return chinese / meaningful.length > 0.6;
}

export function isVisible(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return true;
  let current: Element | null = element;
  while (current) {
    const style = view.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      (style.opacity !== '' && Number(style.opacity) === 0)
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

export function isTranslatableElement(
  element: Element,
  targetLanguage = 'zh',
): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.matches(EXCLUDED_SELECTOR) || element.closest(EXCLUDED_SELECTOR)) return false;
  if (!isVisible(element)) return false;

  const text = normalizeText(element.textContent ?? '');
  if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) return false;
  if (isMostlyTargetLanguage(text, targetLanguage)) return false;

  const nested = Array.from(element.querySelectorAll(BLOCK_SELECTOR)).some(
    (child) => child !== element && normalizeText(child.textContent ?? '').length >= 2,
  );
  return !nested;
}

export function collectTextBlocks(
  root: ParentNode = document,
  targetLanguage = 'zh',
): HTMLElement[] {
  const elements: Element[] = [];
  if (root instanceof Element && root.matches(BLOCK_SELECTOR)) elements.push(root);
  elements.push(...Array.from(root.querySelectorAll(BLOCK_SELECTOR)));

  return elements.filter((element) => isTranslatableElement(element, targetLanguage));
}

export function pageSample(elements: HTMLElement[], maxLength = 1500): string {
  let sample = '';
  for (const element of elements) {
    const text = normalizeText(element.textContent ?? '');
    if (!text) continue;
    sample += `${text}\n`;
    if (sample.length >= maxLength) break;
  }
  return sample.slice(0, maxLength);
}
