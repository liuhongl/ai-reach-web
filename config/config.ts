import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import devProxy from './proxy';
import routes from './routes';

export default defineConfig({
  ...(process.env.AI_REACH_E2E === '1' ? { mfsu: false } : {}),
  access: {},
  antd: {
    appConfig: {},
    configProvider: {
      theme: {
        token: {
          colorInfo: defaultSettings.colorPrimary,
          colorPrimary: defaultSettings.colorPrimary,
        },
      },
    },
  },
  esbuildMinifyIIFE: true,
  fastRefresh: true,
  hash: true,
  initialState: {},
  layout: {
    locale: false,
    ...defaultSettings,
  },
  model: {},
  moment2dayjs: {
    plugins: ['duration', 'relativeTime'],
    preset: 'antd',
  },
  npmClient: 'npm',
  request: {},
  proxy: devProxy,
  routes,
  title: 'AI Reach',
});
