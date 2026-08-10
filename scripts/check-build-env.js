const requiredNonEmptyKeys = [
  'UMI_APP_RSA_PUBLIC_KEY',
  'UMI_APP_RSA_PRIVATE_KEY',
  'UMI_APP_CLIENT_ID',
];

const invalidKeys = [
  ...(process.env.UMI_APP_ENCRYPT === 'true' ? [] : ['UMI_APP_ENCRYPT']),
  ...requiredNonEmptyKeys.filter((key) => !process.env[key]?.trim()),
];

if (invalidKeys.length > 0) {
  console.error(`生产构建配置无效：${invalidKeys.join(', ')}`);
  process.exitCode = 1;
}
