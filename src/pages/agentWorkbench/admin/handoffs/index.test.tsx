import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.join(__dirname, 'index.tsx');

describe('handoff administration page', () => {
  it('covers diagnostics metrics, filters, detail order and abnormal-only reconciliation', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const text of [
      '请求数',
      '60 秒内接通率',
      '平均等待时间',
      '等待超时数',
      '媒体接入失败数',
      '时间范围',
      '业务场景',
      '转人工状态',
      '接听坐席',
      '客户姓名',
      '客户标识',
      '转人工原因',
      '等待时长',
      '请求时间',
      '最终结果',
      '基本信息',
      '状态时间线',
      'AI 交接摘要与待处理事项',
      '转接前对话摘录',
      '本次转人工未保存转接前对话',
      '通话录音',
      '暂无可播放录音',
      '快速话后结果',
      '关联跟进任务',
      '客户分类',
      '沟通结论',
      '后续安排',
      '提交坐席',
      '任务状态',
      '跟进原因',
      '负责坐席',
      '应回访时间',
      '重新核对状态',
      '查看详情',
      'getHandoffReasonLabel',
      'getDialogueSpeakerLabel',
      'getAfterCallWorkLabel',
      'getRecordingStatusLabel',
      'statusColors',
      'getHandoffCustomerIdentity',
      'normalizeHandoffMetrics',
    ])
      expect(source).toContain(text);
    expect(source).toContain('failure_stage');
    expect(source).toContain('terminalHandoffStatuses.has(row.status)');
    expect(source).toContain('reconcileAdminHandoff');
    expect(source).toContain('核对完成，当前状态无需调整');
    expect(source).toContain('核对完成，状态已更新为');
    expect(source).toContain('getAiCallRecordRecording');
    expect(source).toContain('handoff-recording-player');
    expect(source).toContain('<audio');
    expect(source).toContain('styles={detailDescriptionStyles}');
    expect(source).not.toContain("title: 'call_id'");
    expect(source).not.toContain("title: '是否生成未接回访'");
    expect(source).not.toContain("label: 'handoff_id'");
    expect(source).not.toContain('通话配置快照（排查用）');
    expect(source).not.toContain('本次通话未保存配置快照');
    expect(source).not.toContain('>三方对话<');
    expect(source).not.toContain("label: '模型与话术配置'");
    expect(source).not.toContain('重新补偿');
    expect(source).not.toContain('修改正常结果');
    expect(source).not.toContain("row.status === 'failed'");
    expect(source).not.toContain('followUpTaskName');
  });

  it('keeps the filter area to common conditions and reuses record dialogue bubbles', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    for (const key of [
      'requested_at_filter',
      'scene_code_filter',
      'status_filter',
      'customer_name_filter',
    ]) {
      expect(source).toContain(`key: '${key}'`);
    }
    expect(source).not.toContain('human_agent_identity_filter');
    expect(source).toContain('requestedAtBegin');
    expect(source).toContain('requestedAtEnd');
    expect(source).toContain('customerName');
    expect(source).toContain('beforeSearchSubmit={(values) => {');
    expect(source).toContain('values.requested_at_filter');
    expect(source).toContain('values.requested_at_range');
    expect(source).toContain('values.scene_code_filter');
    expect(source).toContain('values.scene_code');
    expect(source).toContain('values.status_filter');
    expect(source).toContain('values.status');
    expect(source).toContain('values.customer_name_filter');
    expect(source).toContain('values.customer_name');
    expect(source).not.toContain('formRef={formRef}');
    expect(source).toContain('ai-call-dialogue-region');
    expect(source).toContain('ai-call-dialogue-row--');
    expect(source).toContain('ai-call-dialogue-bubble--');
  });
});
