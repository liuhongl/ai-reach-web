import { configUmiAlias, createConfig } from '@umijs/max/test.js';

export default async (): Promise<unknown> => {
  const config = await configUmiAlias({
    ...createConfig({
      target: 'browser',
    }),
  });

  return {
    ...config,
    testEnvironmentOptions: {
      ...(config.testEnvironmentOptions || {}),
      url: 'http://localhost:8078',
    },
    testPathIgnorePatterns: ['/node_modules/'],
    setupFiles: [...(config.setupFiles || []), './tests/setupTests.jsx'],
  };
};
