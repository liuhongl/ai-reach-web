import {
  describeConnectedOutcome,
  getCallDurationLabel,
  getClassificationReviewPresentation,
  getConnectionTimeLabel,
  getCustomerIntentPresentation,
  getFollowUpPresentation,
  getQualityReviewPresentation,
  getQualityScorePresentation,
  hasUnstablePostCallData,
  isHumanConnectedRecord,
  resolveCallResult,
} from './status';

const baseRecord = {
  id: '1',
  callId: 'call-1',
  entryType: 'sip_outbound',
  status: 'completed',
  startedAt: '2026-07-30T10:00:00+08:00',
} as const;

describe('通话记录话后状态映射', () => {
  it('把已结束但未接通的旧记录识别为呼叫失败', () => {
    expect(
      resolveCallResult({
        status: 'completed',
        answeredAt: null,
        endedAt: '2026-08-27T10:30:21+08:00',
      }),
    ).toBe('call_failed');
    expect(
      resolveCallResult({
        status: 'completed',
        answeredAt: '2026-08-27T10:30:24+08:00',
        endedAt: '2026-08-27T10:33:49+08:00',
      }),
    ).toBe('connected');
  });

  it('区分真人接通、语音信箱和仅线路接通', () => {
    expect(describeConnectedOutcome('human')).toBe('真人接通');
    expect(describeConnectedOutcome('voicemail')).toBe('语音信箱');
    expect(describeConnectedOutcome('transport')).toBe('仅线路接通');
    expect(getConnectionTimeLabel('voicemail')).toBe('语音信箱接入时间');
    expect(getCallDurationLabel('connected', 'transport')).toBe(
      '线路接通时长',
    );
    expect(
      isHumanConnectedRecord({
        ...baseRecord,
        callResult: 'connected',
        answerType: 'voicemail',
      }),
    ).toBe(false);
    expect(
      isHumanConnectedRecord({
        ...baseRecord,
        callResult: 'connected',
        answerType: 'human',
      }),
    ).toBe(true);
    expect(
      isHumanConnectedRecord({
        ...baseRecord,
        callResult: 'connected',
      }),
    ).toBe(false);
  });

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

  it('分类复核与回访任务独立展示', () => {
    expect(
      getFollowUpPresentation({
        ...baseRecord,
      }),
    ).toBeNull();
    expect(
      getClassificationReviewPresentation({
        ...baseRecord,
        classificationReviewStatus: 'suggested',
      }),
    ).toMatchObject({
      text: '建议复核',
      color: 'warning',
      target: 'record',
    });
    expect(
      getFollowUpPresentation({
        ...baseRecord,
        followUpId: 'follow-up-1',
        followUpStatus: 'pending',
      }),
    ).toMatchObject({
      text: '待处理',
      color: 'warning',
      target: 'follow_up',
    });
  });

  it('展示已复核分类', () => {
    expect(
      getClassificationReviewPresentation({
        ...baseRecord,
        classificationReviewStatus: 'reviewed',
      }),
    ).toMatchObject({
      text: '已复核',
      color: 'success',
      target: 'record',
    });
  });

  it('把 Owner Runtime 生成的 outbound 记录纳入正式话后状态', () => {
    const outboundRecord = {
      ...baseRecord,
      entryType: 'outbound',
      analysisStatus: '2',
      customerIntent: 'positive',
      classificationReviewStatus: 'suggested',
    } as const;

    expect(getCustomerIntentPresentation(outboundRecord)).toMatchObject({
      text: '正向',
    });
    expect(getClassificationReviewPresentation(outboundRecord)).toMatchObject({
      text: '建议复核',
    });
  });

  it('展示任务关联 Web 接听的话后结论，但不展示通用浏览器测试', () => {
    const taskWebRecord = {
      ...baseRecord,
      entryType: 'web',
      taskId: 'task-1',
      analysisStatus: '2',
      customerIntent: 'neutral',
      followUpId: 'follow-up-1',
      followUpStatus: 'pending',
    } as const;

    expect(getCustomerIntentPresentation(taskWebRecord)).toMatchObject({
      text: '中性',
    });
    expect(getFollowUpPresentation(taskWebRecord)).toMatchObject({
      text: '待处理',
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
          entryType: 'sip_callback',
          status: 'running',
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
