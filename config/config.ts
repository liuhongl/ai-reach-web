import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';

export default defineConfig({
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
  title: 'AI Reach',
});
