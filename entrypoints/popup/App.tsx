import { useEffect, useMemo, useState } from 'react';
import { ensureContentScript, sendToTab } from '../../lib/injection';
import { getSettings, normalizeOrigin, originPattern, saveSettings } from '../../lib/storage';
import {
  DEFAULT_SETTINGS,
  type DisplayMode,
  type Settings,
  type TranslationStatus,
} from '../../lib/types';

const ACTIVE_PHASES = new Set([
  'detecting',
  'waiting-user',
  'downloading',
  'translating',
  'complete',
]);

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<TranslationStatus>({
    phase: 'idle',
    completed: 0,
    total: 0,
  });
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [busy, setBusy] = useState(true);
  const [uiError, setUiError] = useState<string>();
  const [sitePermissionGranted, setSitePermissionGranted] = useState(false);

  const origin = useMemo(() => normalizeOrigin(tab?.url ?? ''), [tab?.url]);
  const hasSyncedSiteRule = origin ? settings.autoTranslateSites.includes(origin) : false;
  const autoEnabled = hasSyncedSiteRule && sitePermissionGranted;
  const isRunning = ACTIVE_PHASES.has(status.phase) && status.phase !== 'idle';

  useEffect(() => {
    void initialize();
    const listener = (message: { type?: string; status?: TranslationStatus }) => {
      if (message.type === 'TRANSLATION_STATUS_CHANGED' && message.status) {
        setStatus(message.status);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function initialize() {
    try {
      const [saved, tabs] = await Promise.all([
        getSettings(),
        chrome.tabs.query({ active: true, currentWindow: true }),
      ]);
      setSettings(saved);
      const activeTab = tabs[0];
      setTab(activeTab);
      const activeOrigin = normalizeOrigin(activeTab?.url ?? '');
      if (activeTab?.id && activeOrigin) {
        setSitePermissionGranted(
          await chrome.permissions.contains({ origins: [originPattern(activeOrigin)] }),
        );
        await ensureContentScript(activeTab.id);
        const current = (await chrome.tabs.sendMessage(activeTab.id, {
          type: 'GET_TRANSLATION_STATUS',
        })) as TranslationStatus;
        if (current) setStatus(current);
      }
    } catch {
      // A fresh page has no controller yet, or the current URL is restricted.
    } finally {
      setBusy(false);
    }
  }

  async function toggleTranslation() {
    if (!tab?.id || !origin) {
      setUiError('当前页面不允许扩展运行。');
      return;
    }
    setBusy(true);
    setUiError(undefined);
    try {
      const next = (await sendToTab(
        tab.id,
        isRunning ? { type: 'STOP_TRANSLATION' } : { type: 'START_TRANSLATION', settings },
      )) as TranslationStatus;
      if (next) setStatus(next);
    } catch (error) {
      setUiError(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(mode: DisplayMode) {
    const next = { ...settings, displayMode: mode };
    setSettings(next);
    await saveSettings(next);
    if (tab?.id && isRunning) {
      await sendToTab(tab.id, { type: 'SET_DISPLAY_MODE', mode }).catch(() => undefined);
    }
  }

  async function changeTarget(targetLanguage: string) {
    const next = { ...settings, targetLanguage };
    setSettings(next);
    await saveSettings(next);
    if (tab?.id && isRunning) {
      const nextStatus = (await sendToTab(tab.id, {
        type: 'START_TRANSLATION',
        settings: next,
      })) as TranslationStatus;
      if (nextStatus) setStatus(nextStatus);
    }
  }

  async function toggleAutoTranslate() {
    if (!origin) return;
    setUiError(undefined);
    const nextEnabled = !autoEnabled;
    if (nextEnabled) {
      const granted = await chrome.permissions.request({ origins: [originPattern(origin)] });
      if (!granted) {
        setUiError('需要当前站点权限才能自动翻译。');
        return;
      }
      setSitePermissionGranted(true);
    } else {
      await chrome.permissions.remove({ origins: [originPattern(origin)] });
      setSitePermissionGranted(false);
    }

    const autoTranslateSites = nextEnabled
      ? [...new Set([...settings.autoTranslateSites, origin])]
      : settings.autoTranslateSites.filter((item) => item !== origin);
    const next = { ...settings, autoTranslateSites };
    setSettings(next);
    await saveSettings(next);
  }

  const progress =
    status.total > 0 ? Math.min(100, Math.round((status.completed / status.total) * 100)) : 0;
  const error = uiError ?? status.error;

  return (
    <main>
      <header>
        <div className="brand-mark">译</div>
        <div>
          <h1>本地双语翻译</h1>
          <p>内容仅在 Chrome 中处理</p>
        </div>
      </header>

      <section className="controls">
        <label>
          <span>展示方式</span>
          <select
            value={settings.displayMode}
            onChange={(event) => void changeMode(event.target.value as DisplayMode)}
          >
            <option value="bilingual">原文下方显示译文</option>
            <option value="replace">用译文替换原文</option>
          </select>
        </label>
        <label>
          <span>目标语言</span>
          <select
            value={settings.targetLanguage}
            onChange={(event) => void changeTarget(event.target.value)}
          >
            <option value="zh">简体中文</option>
            <option value="zh-Hant">繁体中文</option>
          </select>
        </label>
      </section>

      {(status.phase !== 'idle' && status.phase !== 'stopped') && (
        <section className="status-card">
          <div className="status-row">
            <span>{statusLabel(status)}</span>
            <strong>{status.phase === 'downloading' ? `${status.downloadProgress ?? 0}%` : `${progress}%`}</strong>
          </div>
          <div className="progress">
            <i
              style={{
                width: `${status.phase === 'downloading' ? status.downloadProgress ?? 0 : progress}%`,
              }}
            />
          </div>
          {status.sourceLanguage && <small>检测到：{status.sourceLanguage}</small>}
        </section>
      )}

      {error && <div className="error">{error}</div>}

      <button className={`primary ${isRunning ? 'stop' : ''}`} disabled={busy} onClick={() => void toggleTranslation()}>
        {busy ? '处理中…' : isRunning ? '停止并恢复原文' : '翻译当前网页'}
      </button>

      <label className="switch-row">
        <span>
          <b>自动翻译此网站</b>
          <small>
            {origin
              ? `${origin}${hasSyncedSiteRule && !sitePermissionGranted ? '（本机未授权）' : ''}`
              : '当前页面不支持'}
          </small>
        </span>
        <input
          type="checkbox"
          checked={autoEnabled}
          disabled={!origin}
          onChange={() => void toggleAutoTranslate()}
        />
      </label>

      <button className="link" onClick={() => void chrome.runtime.openOptionsPage()}>
        外观与更多设置
      </button>
    </main>
  );
}

function statusLabel(status: TranslationStatus): string {
  if (status.phase === 'detecting') return '正在识别页面语言';
  if (status.phase === 'waiting-user') return '请在网页内确认下载语言包';
  if (status.phase === 'downloading') return '正在下载本地语言包';
  if (status.phase === 'translating') return `正在翻译 ${status.completed}/${status.total}`;
  if (status.phase === 'complete') return `已完成 ${status.completed}/${status.total}`;
  if (status.phase === 'error') return '翻译失败';
  return '准备中';
}

function readError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Cannot access|chrome:\/\//i.test(message)) return 'Chrome 内置页面不允许扩展运行。';
  return message || '无法启动翻译。';
}
