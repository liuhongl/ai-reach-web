import fs from 'node:fs';
import path from 'node:path';
import {
  getAfterCallWorkLabel,
  getDialogueSpeakerLabel,
  getHandoffCustomerIdentity,
  getHandoffReasonLabel,
  getRecordingStatusLabel,
  normalizeHandoffDetail,
  normalizeHandoffMetrics,
  statusColors,
} from './_shared';

describe('agent administration presentation', () => {
  it('does not render empty decorative blocks in metric cards', () => {
    const source = fs.readFileSync(path.join(__dirname, '_shared.tsx'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, 'admin.css'), 'utf8');

    expect(source).not.toContain('agent-admin-metric-icon');
    expect(styles).not.toContain('.agent-admin-metric-icon');
    expect(source).toContain('agent-admin-metric-card--');
    expect(styles).toContain('.agent-admin-metric-card--red');
  });

  it('uses clear Chinese labels and semantic colors', () => {
    expect(getHandoffReasonLabel('customer_request')).toBe('客户要求转人工');
    expect(getHandoffReasonLabel('business_escalation')).toBe('业务升级转人工');
    expect(getHandoffReasonLabel('unknown_reason')).toBe('其他原因');
    expect(statusColors.completed).toBe('success');
    expect(statusColors.failed).toBe('error');
    expect(statusColors.expired).toBe('orange');
  });

  it('translates detail enums and missing recording state for operators', () => {
    expect(getDialogueSpeakerLabel('ai')).toBe('AI');
    expect(getDialogueSpeakerLabel('customer')).toBe('客户');
    expect(getAfterCallWorkLabel('follow_up_required')).toBe('需要后续跟进');
    expect(getRecordingStatusLabel('completed')).toBe('录音已生成');
    expect(getRecordingStatusLabel('not_generated')).toBe('未生成录音');
    expect(getRecordingStatusLabel()).toBe('未生成录音');
  });

  it('does not expose raw business or call identifiers as customer identity', () => {
    expect(
      getHandoffCustomerIdentity({
        masked_customer_name: '张**',
        masked_contact: '138****0000',
        business_id: 'lead-1',
        call_id: 'call-1',
      }),
    ).toEqual({
      primary: '张**',
      secondary: '138****0000',
    });
    expect(
      getHandoffCustomerIdentity({
        business_id: 'lead-2',
        call_id: 'call-2',
      }),
    ).toEqual({
      primary: '客户信息未提供',
      secondary: '-',
    });
    expect(getHandoffCustomerIdentity({ call_id: 'call-3' })).toEqual({
      primary: '客户信息未提供',
      secondary: '-',
    });
  });

  it('normalizes the nested admin detail contract and real metric keys', () => {
    expect(
      normalizeHandoffDetail({
        data: {
          handoff: {
            handoff_id: 'handoff-1',
            call_id: 'call-1',
            scene_code: 'intro_geo',
            status: 'completed',
            requested_at: '2026-07-27T01:00:00Z',
            request_reason: 'customer_request',
          },
          record: {
            masked_contact: '138****0000',
            business_id: 'lead-1',
          },
          after_call_work: { summary: '客户问题已解决' },
          follow_up: { id: 'follow-up-1' },
        },
      }),
    ).toMatchObject({
      handoff: { handoff_id: 'handoff-1' },
      record: { masked_contact: '138****0000' },
      afterCallWork: { summary: '客户问题已解决' },
      followUp: { id: 'follow-up-1' },
    });

    expect(
      normalizeHandoffMetrics({
        request_count: 43,
        connected_rate_within_60_seconds: 0.75,
        average_wait_seconds: 12.6,
        timeout_count: 2,
        media_failure_count: 1,
      }),
    ).toEqual({
      requests: 43,
      connectRate: 75,
      averageWaitSeconds: 12.6,
      timeoutCount: 2,
      mediaFailureCount: 1,
    });
  });
});
