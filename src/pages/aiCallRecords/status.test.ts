import {
  getCustomerIntentPresentation,
  getFollowUpPresentation,
  getQualityReviewPresentation,
  getQualityScorePresentation,
  hasUnstablePostCallData,
} from './status';

const baseRecord = {
  id: '1',
  callId: 'call-1',
  entryType: 'sip_outbound',
  status: 'completed',
  startedAt: '2026-07-30T10:00:00+08:00',
} as const;

describe('通话记录话后状态映射', () => {
  it('区分语义分析中、失败和客户意向', () => {
    expect(
      getCustomerIntentPresentation({
        ...baseRecord,
        analysisStatus: '1',
      }),
    ).toMatchObject({ text: '分析中', color: 'processing' });
    expect(
      getCustomerIntentPresentation({
        ...baseRecord,
        analysisStatus: '3',
      }),
    ).toMatchObject({ text: '分析失败', color: 'error' });
    expect(
      getCustomerIntentPresentation({
        ...baseRecord,
        analysisStatus: '2',
        customerIntent: 'positive',
      }),
    ).toMatchObject({ text: '正向', color: 'success' });
  });

  it('区分待人工确认与已创建的正式跟进任务', () => {
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpSuggested: true,
        followUpRequiresReview: false,
      }),
    ).toBeNull();
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpSuggested: true,
        followUpRequiresReview: true,
      }),
    ).toMatchObject({
      text: '待人工确认',
      color: 'warning',
      target: 'record',
    });
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpSuggested: true,
        followUpId: 'follow-up-1',
        followUpStatus: 'pending',
      }),
    ).toMatchObject({
      text: '待跟进',
      color: 'warning',
      target: 'follow_up',
    });
  });

  it('展示人工确认的无需跟进结论', () => {
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpSuggested: true,
        followUpReviewStatus: 'dismissed',
      }),
    ).toMatchObject({
      text: '无需跟进',
      color: 'default',
      target: 'record',
    });
  });

  it('把 Owner Runtime 生成的 outbound 记录纳入正式话后状态', () => {
    const outboundRecord = {
      ...baseRecord,
      entryType: 'outbound',
      analysisStatus: '2',
      customerIntent: 'positive',
      followUpSuggested: true,
      followUpRequiresReview: true,
    } as const;

    expect(getCustomerIntentPresentation(outboundRecord)).toMatchObject({
      text: '正向',
    });
    expect(getFollowUpPresentation(outboundRecord)).toMatchObject({
      text: '待人工确认',
    });
  });

  it('展示任务关联 Web 接听的话后结论，但不展示通用浏览器测试', () => {
    const taskWebRecord = {
      ...baseRecord,
      entryType: 'web',
      taskId: 'task-1',
      analysisStatus: '2',
      customerIntent: 'neutral',
      followUpSuggested: true,
      followUpId: 'follow-up-1',
      followUpStatus: 'pending',
    } as const;

    expect(getCustomerIntentPresentation(taskWebRecord)).toMatchObject({
      text: '中性',
    });
    expect(getFollowUpPresentation(taskWebRecord)).toMatchObject({
      text: '待跟进',
      target: 'follow_up',
    });
    expect(
      getCustomerIntentPresentation({ ...taskWebRecord, taskId: null }),
    ).toBeNull();
    expect(
      getFollowUpPresentation({ ...taskWebRecord, taskId: null }),
    ).toBeNull();
  });

  it('不把 Mock 记录展示成正式话后结论', () => {
    const mockRecord = {
      ...baseRecord,
      entryType: 'outbound_mock',
      analysisStatus: '2',
      customerIntent: 'positive',
      followUpSuggested: true,
    } as const;
    expect(getCustomerIntentPresentation(mockRecord)).toBeNull();
    expect(getFollowUpPresentation(mockRecord)).toBeNull();
  });

  it('只展示 AI 评分数值，并把人工质检结果映射为四档', () => {
    expect(
      getQualityScorePresentation({
        ...baseRecord,
        qualityScoreStatus: 'completed',
        qualityScore: 86,
      }),
    ).toMatchObject({
      text: '86分',
      color: 'success',
      tooltip: 'AI 根据录音和通话转写自动评分，点击复核查看评分理由',
    });
    expect(
      getQualityScorePresentation({
        ...baseRecord,
        qualityScoreStatus: 'pending',
      }),
    ).toMatchObject({ text: '待评分', color: 'default' });
    expect(getQualityReviewPresentation('excellent')).toMatchObject({
      text: '优秀',
      color: 'purple',
    });
    expect(getQualityReviewPresentation('fail')).toMatchObject({
      text: '不合格',
      color: 'error',
    });
  });

  it('把关联不完整的正式跟进任务标记为状态异常', () => {
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpId: 'follow-up-1',
        followUpStatus: null,
      }),
    ).toMatchObject({
      text: '状态异常',
      color: 'error',
      target: null,
    });
  });

  it('只对尚未终止或仍在分析的正式通话启用有界轮询', () => {
    expect(
      hasUnstablePostCallData([
        { ...baseRecord, status: 'running' },
        { ...baseRecord, analysisStatus: '2' },
      ]),
    ).toBe(true);
    expect(
      hasUnstablePostCallData([
        { ...baseRecord, analysisStatus: '2' },
        {
          ...baseRecord,
          status: 'failed',
          analysisStatus: '3',
          qualityScoreStatus: 'completed',
        },
      ]),
    ).toBe(false);
    expect(
      hasUnstablePostCallData([
        {
          ...baseRecord,
          analysisStatus: '2',
          qualityScoreStatus: 'pending',
        },
      ]),
    ).toBe(true);
    expect(
      hasUnstablePostCallData([
        {
          ...baseRecord,
          entryType: 'outbound_mock',
          status: 'running',
        },
      ]),
    ).toBe(false);
  });
});
