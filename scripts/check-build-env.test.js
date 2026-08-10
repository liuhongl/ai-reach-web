const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = path.join(__dirname, 'check-build-env.js');
const requiredKeys = [
  'UMI_APP_ENCRYPT',
  'UMI_APP_RSA_PUBLIC_KEY',
  'UMI_APP_RSA_PRIVATE_KEY',
  'UMI_APP_CLIENT_ID',
];

const runCheck = (values = {}) => {
  const env = { ...process.env };
  requiredKeys.forEach((key) => {
    delete env[key];
  });
  Object.assign(env, values);
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env,
  });
};

describe('production build environment guard', () => {
  it('缺少配置时列出变量名并失败', () => {
    const result = runCheck();

    expect(result.status).toBe(1);
    requiredKeys.forEach((key) => {
      expect(result.stderr).toContain(key);
    });
  });

  it('加密开关不是 true 时失败且不输出配置值', () => {
    const result = runCheck({
      UMI_APP_ENCRYPT: 'false',
      UMI_APP_RSA_PUBLIC_KEY: 'public-value',
      UMI_APP_RSA_PRIVATE_KEY: 'private-value',
      UMI_APP_CLIENT_ID: 'client-value',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('UMI_APP_ENCRYPT');
    expect(result.stderr).not.toContain('public-value');
    expect(result.stderr).not.toContain('private-value');
    expect(result.stderr).not.toContain('client-value');
  });

  it('配置完整时成功且没有错误输出', () => {
    const result = runCheck({
      UMI_APP_ENCRYPT: 'true',
      UMI_APP_RSA_PUBLIC_KEY: 'public-value',
      UMI_APP_RSA_PRIVATE_KEY: 'private-value',
      UMI_APP_CLIENT_ID: 'client-value',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});
