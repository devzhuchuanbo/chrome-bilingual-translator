import { collectTextBlocks, normalizeText, pageSample } from './dom/extractor';
import { TranslationRenderer } from './render/renderer';
import { ChromeTranslationService, normalizeLanguage } from './translator/chrome';
import type {
  DisplayMode,
  Settings,
  TranslationStatus,
  TranslationStyle,
} from './types';

export class TranslationController {
  private readonly service = new ChromeTranslationService();
  private renderer?: TranslationRenderer;
  private settings?: Settings;
  private status: TranslationStatus = { phase: 'idle', completed: 0, total: 0 };
  private abortController?: AbortController;
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private queue: HTMLElement[] = [];
  private readonly queued = new Set<HTMLElement>();
  private processing = false;
  private sourceLanguage = 'en';
  private activationPrompt?: HTMLElement;

  getStatus(): TranslationStatus {
    return { ...this.status };
  }

  async start(settings: Settings): Promise<TranslationStatus> {
    this.reset(false);
    this.settings = settings;
    this.abortController = new AbortController();
    this.renderer = new TranslationRenderer(settings.displayMode, settings.style);
    this.updateStatus({ phase: 'detecting', completed: 0, total: 0, error: undefined });

    try {
      const blocks = collectTextBlocks(document, settings.targetLanguage);
      this.status.total = blocks.length;
      if (blocks.length === 0) {
        this.updateStatus({ phase: 'complete' });
        return this.getStatus();
      }

      const fallback = document.documentElement.lang || 'en';
      this.sourceLanguage = await this.service.detectLanguage(
        pageSample(blocks),
        fallback,
        this.abortController.signal,
      );
      this.status.sourceLanguage = this.sourceLanguage;

      if (normalizeLanguage(this.sourceLanguage) === normalizeLanguage(settings.targetLanguage)) {
        this.updateStatus({ phase: 'complete', completed: blocks.length });
        return this.getStatus();
      }

      const availability = await this.service.getAvailability(
        this.sourceLanguage,
        settings.targetLanguage,
      );
      if (availability === 'unavailable') {
        throw new Error(
          `当前 Chrome 或设备不支持 ${this.sourceLanguage} → ${settings.targetLanguage} 翻译。`,
        );
      }

      if (availability === 'available') {
        this.updateStatus({ phase: 'downloading', downloadProgress: 100 });
        await this.service.prepare(
          this.sourceLanguage,
          settings.targetLanguage,
          undefined,
          this.abortController.signal,
          true,
        );
      } else {
        await this.waitForModelDownload(settings.targetLanguage);
      }

      this.updateStatus({ phase: 'translating', downloadProgress: 100 });
      this.watchDocument();
      this.schedule(blocks);
      return this.getStatus();
    } catch (error) {
      if (this.abortController.signal.aborted) return this.getStatus();
      this.updateStatus({
        phase: 'error',
        error: error instanceof Error ? error.message : '翻译初始化失败。',
      });
      return this.getStatus();
    }
  }

  stop(): void {
    this.reset(true);
    this.updateStatus({ phase: 'stopped', completed: 0, total: 0 });
  }

  setMode(mode: DisplayMode): void {
    this.renderer?.setMode(mode);
    if (this.settings) this.settings.displayMode = mode;
  }

  updateStyle(style: TranslationStyle): void {
    this.renderer?.updateStyle(style);
    if (this.settings) this.settings.style = style;
  }

  private watchDocument(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement);
        this.enqueue(visible, true);
      },
      { rootMargin: '400px 0px' },
    );

    this.mutationObserver = new MutationObserver((mutations) => {
      const added: HTMLElement[] = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && !node.closest('[data-local-translator]')) {
            added.push(...collectTextBlocks(node, this.settings?.targetLanguage));
          }
        }
      }
      if (added.length > 0) {
        const fresh = added.filter(
          (element) => !this.queued.has(element) && !this.renderer?.has(element),
        );
        if (fresh.length > 0) {
          this.status.total += fresh.length;
          this.updateStatus({ phase: 'translating' });
          this.schedule(fresh);
        }
      }
      this.renderer?.removeDisconnected();
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private schedule(elements: HTMLElement[]): void {
    for (const element of elements) this.intersectionObserver?.observe(element);

    const ordered = [...elements].sort((left, right) => {
      const leftTop = Math.abs(left.getBoundingClientRect().top);
      const rightTop = Math.abs(right.getBoundingClientRect().top);
      return leftTop - rightTop;
    });
    this.enqueue(ordered);
  }

  private enqueue(elements: HTMLElement[], prioritize = false): void {
    const fresh = elements.filter(
      (element) => !this.queued.has(element) && !this.renderer?.has(element),
    );
    for (const element of fresh) {
      this.queued.add(element);
      this.intersectionObserver?.unobserve(element);
    }
    if (prioritize) this.queue.unshift(...fresh);
    else this.queue.push(...fresh);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this.settings || !this.renderer || !this.abortController) return;
    this.processing = true;

    while (this.queue.length > 0 && !this.abortController.signal.aborted) {
      const element = this.queue.shift()!;
      this.queued.delete(element);
      if (!element.isConnected || this.renderer.has(element)) continue;

      const sourceText = normalizeText(element.textContent ?? '');
      try {
        let translated: string;
        try {
          translated = await this.service.translate(
            sourceText,
            this.sourceLanguage,
            this.settings.targetLanguage,
            this.abortController.signal,
          );
        } catch (error) {
          if (this.abortController.signal.aborted) throw error;
          translated = await this.service.translate(
            sourceText,
            this.sourceLanguage,
            this.settings.targetLanguage,
            this.abortController.signal,
          );
        }
        if (!this.abortController.signal.aborted) this.renderer.render(element, translated);
      } catch (error) {
        if (this.abortController.signal.aborted) break;
        console.warn('[本地双语翻译] 段落翻译失败', error);
      } finally {
        if (!this.abortController.signal.aborted) {
          this.status.completed += 1;
          this.updateStatus({});
        }
      }
    }

    this.processing = false;
    if (!this.abortController.signal.aborted && this.status.completed >= this.status.total) {
      this.updateStatus({ phase: 'complete' });
    }
  }

  private reset(clearRenderer: boolean): void {
    this.abortController?.abort();
    this.activationPrompt?.remove();
    this.activationPrompt = undefined;
    this.mutationObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.queue = [];
    this.queued.clear();
    this.processing = false;
    if (clearRenderer) {
      this.renderer?.clear();
      this.renderer = undefined;
      this.service.destroy();
    } else {
      this.renderer?.clear();
      this.renderer = undefined;
    }
  }

  private updateStatus(patch: Partial<TranslationStatus>): void {
    this.status = { ...this.status, ...patch };
    try {
      const pending = chrome.runtime.sendMessage({
        type: 'TRANSLATION_STATUS_CHANGED',
        status: this.status,
      });
      void pending.catch(() => undefined);
    } catch {
      // Popup may not be open.
    }
  }

  private waitForModelDownload(targetLanguage: string): Promise<void> {
    const signal = this.abortController!.signal;
    this.updateStatus({ phase: 'waiting-user', downloadProgress: 0 });

    return new Promise((resolve, reject) => {
      const host = document.createElement('div');
      host.dataset.localTranslator = 'model-prompt';
      host.style.cssText =
        'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,sans-serif';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          .card{width:300px;padding:18px;border:1px solid #dfe4ec;border-radius:14px;background:#fff;
            color:#182230;box-shadow:0 14px 40px rgb(15 23 42 / 24%)}
          h2{margin:0 0 7px;font-size:16px}p{margin:0 0 14px;color:#667085;font-size:13px;line-height:1.55}
          button{width:100%;padding:10px;border:0;border-radius:9px;color:#fff;background:#5267df;
            font:600 14px system-ui,sans-serif;cursor:pointer}
        </style>
        <div class="card" role="dialog" aria-live="polite">
          <h2>下载本地翻译语言包</h2>
          <p>Chrome 首次使用需要您在网页内确认。语言包下载后，翻译内容仍只在本机处理。</p>
          <button type="button">下载并开始翻译</button>
        </div>
      `;
      const button = shadow.querySelector('button')!;
      this.activationPrompt = host;
      document.documentElement.append(host);

      const abort = () => {
        host.remove();
        reject(new DOMException('翻译已停止', 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });

      button.addEventListener(
        'click',
        () => {
          // Translator.create must be invoked directly from this page click.
          const preparation = this.service.prepare(
            this.sourceLanguage,
            targetLanguage,
            (downloadProgress) =>
              this.updateStatus({ phase: 'downloading', downloadProgress }),
            signal,
            true,
          );
          this.updateStatus({ phase: 'downloading', downloadProgress: 0 });
          button.setAttribute('disabled', 'true');
          button.textContent = '正在下载…';
          void preparation.then(
            () => {
              signal.removeEventListener('abort', abort);
              host.remove();
              this.activationPrompt = undefined;
              resolve();
            },
            (error) => {
              signal.removeEventListener('abort', abort);
              host.remove();
              this.activationPrompt = undefined;
              reject(error);
            },
          );
        },
        { once: true },
      );
    });
  }
}
