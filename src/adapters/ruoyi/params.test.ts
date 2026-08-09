import {
  addRuoyiDateRange,
  normalizeRuoyiParams,
  serializeRuoyiParams,
} from './params';

describe('RuoYi params serializer', () => {
  it('adds Vue-compatible date range query params', () => {
    expect(
      addRuoyiDateRange({ pageNum: 1, pageSize: 20 }, [
        '2026-05-03 00:00:00',
        '2026-06-01 23:59:59',
      ]),
    ).toEqual({
      pageNum: 1,
      pageSize: 20,
      params: {
        beginTime: '2026-05-03 00:00:00',
        endTime: '2026-06-01 23:59:59',
      },
    });
  });

  it('normalizes nested params into backend-bindable bracket keys', () => {
    expect(
      normalizeRuoyiParams({
        pageNum: 1,
        pageSize: 20,
        params: {
          beginTime: '2026-05-03 00:00:00',
          endTime: '2026-06-01 23:59:59',
        },
      }),
    ).toEqual({
      pageNum: 1,
      pageSize: 20,
      'params[beginTime]': '2026-05-03 00:00:00',
      'params[endTime]': '2026-06-01 23:59:59',
    });
  });

  it('matches Vue tansParams bracket notation for nested params', () => {
    expect(
      serializeRuoyiParams({
        pageNum: 1,
        pageSize: 20,
        params: {
          beginTime: '2026-05-03 00:00:00',
          endTime: '2026-06-01 23:59:59',
        },
      }),
    ).toBe(
      'pageNum=1&pageSize=20&params%5BbeginTime%5D=2026-05-03%2000%3A00%3A00&params%5BendTime%5D=2026-06-01%2023%3A59%3A59',
    );
  });

  it('skips empty values like the Vue request utility', () => {
    expect(
      serializeRuoyiParams({
        dictName: '',
        dictType: undefined,
        params: {
          beginTime: undefined,
          endTime: '2026-06-01 23:59:59',
        },
      }),
    ).toBe('params%5BendTime%5D=2026-06-01%2023%3A59%3A59');
  });

  it('keeps bracket keys compatible with the backend binder', () => {
    expect(
      serializeRuoyiParams({
        'params[beginTime]': '2026-05-03 00:00:00',
        'params[endTime]': '2026-06-01 23:59:59',
      }),
    ).toBe(
      'params%5BbeginTime%5D=2026-05-03%2000%3A00%3A00&params%5BendTime%5D=2026-06-01%2023%3A59%3A59',
    );
  });
});
