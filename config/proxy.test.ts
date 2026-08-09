import devProxy from './proxy';

describe('dev proxy', () => {
  it('只暴露 RuoYi 与 AI Call 两个代理', () => {
    expect(devProxy['/dev-api']).toMatchObject({
      target: process.env.UMI_APP_API_TARGET || 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: { '^/dev-api': '' },
    });
    expect(devProxy['/ai-call-agent-api']).toMatchObject({
      target:
        process.env.UMI_APP_AI_CALL_API_TARGET || 'http://127.0.0.1:19011',
      changeOrigin: true,
      proxyTimeout: 0,
      timeout: 0,
      pathRewrite: { '^/ai-call-agent-api': '' },
    });
    expect(devProxy['/admin-api']).toBeUndefined();
    expect(devProxy['/voice-api']).toBeUndefined();
    expect(devProxy['/ai-call-lab-api']).toBeUndefined();
  });
});
