import dayjs from 'dayjs';
import {
  buildAppliedQuery,
  getDefaultDateRange,
  validateDateRange,
} from './domain';

describe('AI Call 外呼统计领域规则', () => {
  const now = dayjs('2026-07-31T16:20:00+08:00');

  it('默认选择今天及之前六个自然日', () => {
    const [begin, end] = getDefaultDateRange(now);

    expect(begin.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-25 00:00:00');
    expect(end.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-31 23:59:59');
  });

  it('跨日查询使用下一自然日零点作为右开边界', () => {
    const query = buildAppliedQuery(
      [dayjs('2026-07-25'), dayjs('2026-07-31')],
      'Asia/Shanghai',
    );

    expect(query.granularity).toBe('day');
    expect(dayjs(query.startedAtEnd).format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2026-08-01 00:00:00',
    );
  });

  it('同一天查询使用小时粒度', () => {
    const query = buildAppliedQuery(
      [dayjs('2026-07-31'), dayjs('2026-07-31')],
      'Asia/Shanghai',
    );

    expect(query.granularity).toBe('hour');
  });

  it('把已选择的场景和任务加入统计查询', () => {
    const query = buildAppliedQuery(
      [dayjs('2026-07-31'), dayjs('2026-07-31')],
      'Asia/Shanghai',
      { sceneCode: 'product_intro', taskId: '100' },
    );

    expect(query.sceneCode).toBe('product_intro');
    expect(query.taskId).toBe('100');
  });

  it('拒绝超过九十个自然日和未来日期', () => {
    expect(
      validateDateRange([dayjs('2026-05-02'), dayjs('2026-07-31')], now),
    ).toBe('统计范围不能超过 90 个自然日');
    expect(
      validateDateRange([dayjs('2026-08-01'), dayjs('2026-08-01')], now),
    ).toBe('不能选择未来日期');
  });

});
