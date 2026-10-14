import { useEffect, useState } from 'react';
import { getSettings, originPattern, saveSettings } from '../../lib/storage';
import { DEFAULT_SETTINGS, type DisplayMode, type Settings } from '../../lib/types';

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  async function removeSite(origin: string) {
    await chrome.permissions.remove({ origins: [originPattern(origin)] });
    await update({
      autoTranslateSites: settings.autoTranslateSites.filter((item) => item !== origin),
    });
  }

  return (
    <main>
      <header>
        <div className="logo">译</div>
        <div>
          <h1>本地双语翻译</h1>
          <p>设置会保存在当前 Chrome 用户配置中</p>
        </div>
        {saved && <span className="saved">已保存</span>}
      </header>

      <section>
        <h2>默认翻译</h2>
        <label className="row">
          <span>
            <b>展示方式</b>
            <small>可随时在弹窗中切换</small>
          </span>
          <select
            value={settings.displayMode}
            onChange={(event) => void update({ displayMode: event.target.value as DisplayMode })}
          >
            <option value="bilingual">原文下方显示译文</option>
            <option value="replace">用译文替换原文</option>
          </select>
        </label>
        <label className="row">
          <span><b>目标语言</b></span>
          <select
            value={settings.targetLanguage}
            onChange={(event) => void update({ targetLanguage: event.target.value })}
          >
            <option value="zh">简体中文</option>
            <option value="zh-Hant">繁体中文</option>
          </select>
        </label>
      </section>

      <section>
        <h2>译文外观</h2>
        <label className="row">
          <span><b>译文颜色</b></span>
          <input
            type="color"
            value={settings.style.color}
            onChange={(event) =>
              void update({ style: { ...settings.style, color: event.target.value } })
            }
          />
        </label>
        <label className="row">
          <span>
            <b>字号比例</b>
            <small>{settings.style.fontSize}%</small>
          </span>
          <input
            type="range"
            min="80"
            max="120"
            step="5"
            value={settings.style.fontSize}
            onChange={(event) =>
              void update({
                style: { ...settings.style, fontSize: Number(event.target.value) },
              })
            }
          />
        </label>
        <label className="row">
          <span>
            <b>上下间距</b>
            <small>{settings.style.spacing}px</small>
          </span>
          <input
            type="range"
            min="0"
            max="20"
            value={settings.style.spacing}
            onChange={(event) =>
              void update({
                style: { ...settings.style, spacing: Number(event.target.value) },
              })
            }
          />
        </label>
        <div className="preview">
          <p>Read the world in its original voice.</p>
          <p
            style={{
              color: settings.style.color,
              fontSize: `${settings.style.fontSize}%`,
              marginTop: settings.style.spacing,
            }}
          >
            用原本的声音阅读世界。
          </p>
        </div>
      </section>

      <section>
        <h2>自动翻译网站</h2>
        {settings.autoTranslateSites.length === 0 ? (
          <p className="empty">尚未添加网站。可在扩展弹窗中为当前网站开启。</p>
        ) : (
          <ul>
            {settings.autoTranslateSites.map((origin) => (
              <li key={origin}>
                <span>{origin}</span>
                <button onClick={() => void removeSite(origin)}>移除</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside>
        <b>隐私说明</b>
        <p>网页文本由 Chrome 内置模型在设备本地处理，本扩展不上传、收集或共享翻译内容。</p>
      </aside>
    </main>
  );
}
