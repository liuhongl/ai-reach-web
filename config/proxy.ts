import type { ProxyOptions } from '@umijs/bundler-utils/dist/types';

const keepAlive = {
  proxyTimeout: 0,
  timeout: 0,
  headers: {
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  },
};

const devProxy: Record<string, ProxyOptions> = {
  '/dev-api': {
    target: process.env.UMI_APP_API_TARGET || 'http://localhost:8080',
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/dev-api': '' },
    ...keepAlive,
  },
  '/ai-call-agent-api': {
    target:
      process.env.UMI_APP_AI_CALL_API_TARGET || 'http://127.0.0.1:19011',
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/ai-call-agent-api': '' },
    ...keepAlive,
  },
};

export default devProxy;
