import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '本地双语翻译',
    description: '使用 Chrome 内置翻译模型，在网页原文下显示中文或以中文替换原文。',
    permissions: ['activeTab', 'scripting', 'storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    minimum_chrome_version: '138',
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // Runtime content scripts are injected under activeTab or an explicitly
      // granted site permission, so WXT's generated broad host grant is removed.
      manifest.host_permissions = [];
    },
  },
});
