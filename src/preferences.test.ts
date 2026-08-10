import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  buildPreferenceSettings,
  readPreferences,
  writePreferences,
} from './preferences';

describe('AI Reach preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('没有本地设置时默认深色导航', () => {
    expect(readPreferences()).toEqual({
      ...DEFAULT_PREFERENCES,
      appearance: 'dark-nav',
    });
  });

  it('读取并保存合法设置', () => {
    const preferences = {
      appearance: 'dark-nav' as const,
      colorPrimary: '#1677FF' as const,
      fixedHeader: true,
      fixSiderbar: false,
    };

    writePreferences(preferences);

    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')).toEqual(
      preferences,
    );
    expect(readPreferences()).toEqual(preferences);
  });

  it('逐字段回退无效设置并保留合法字段', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        appearance: 'full-dark',
        colorPrimary: '#13C2C2',
        fixedHeader: 'yes',
        fixSiderbar: false,
      }),
    );

    expect(readPreferences()).toEqual({
      ...DEFAULT_PREFERENCES,
      colorPrimary: '#13C2C2',
      fixSiderbar: false,
    });
  });

  it('深色导航只生成侧栏主题 Token', () => {
    expect(
      buildPreferenceSettings({
        ...DEFAULT_PREFERENCES,
        appearance: 'dark-nav',
        colorPrimary: '#13C2C2',
      }),
    ).toMatchObject({
      navTheme: 'light',
      colorPrimary: '#13C2C2',
      token: {
        sider: {
          colorMenuBackground: '#1a1d24',
          colorBgMenuItemSelected: '#13C2C229',
        },
      },
    });
  });

  it('存储不可用时不阻止读取和保存', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(() => writePreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });
});
