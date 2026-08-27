import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordRecording,
} from '@/pages/aiCallRecords/service';
import FollowUpCallDetail from './FollowUpCallDetail';

jest.mock('@/pages/aiCallRecords/service', () => ({
  getAiCallRecordDetail: jest.fn(),
  getAiCallRecordDialogue: jest.fn(),
  getAiCallRecordRecording: jest.fn(),
}));

void React.createElement;

describe('FollowUpCallDetail', () => {
  it('展示本次回拨的录音和对话，并禁用下载', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-2',
        callId: 'call-2',
        entryType: 'sip_callback',
        status: 'completed',
        startedAt: '2026-08-05T16:52:30+08:00',
      },
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'recording-2',
      callId: 'call-2',
      status: 'completed',
      playUrl: 'https://example.com/call-2.mp3',
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'segment-2',
          callId: 'call-2',
          segmentNo: 1,
          speakerType: 'human_agent',
          text: '我为您安排回访。',
          segmentStatus: 'final',
        },
        {
          id: 'segment-3',
          callId: 'call-2',
          segmentNo: 2,
          speakerType: 'customer',
          text: '好的，麻烦您了。',
          segmentStatus: 'final',
        },
      ],
      total: 1,
    });

    render(
      <FollowUpCallDetail
        callId="call-2"
        followUp={{
          id: 'follow-up-1',
          source_type: 'after_call_work',
          source_call_id: 'call-1',
          source_handoff_id: null,
          scene_code: 'intro_geo',
          status: 'processing',
          follow_up_reason: '客户要求回访',
          created_at: '2026-08-05T16:00:00+08:00',
        }}
      />,
    );

    expect(await screen.findByText('本次回拨')).toBeTruthy();
    expect(screen.getByText('所属跟进任务').style.color).toBe(
      'rgb(31, 31, 31)',
    );
    await waitFor(() =>
      expect(getAiCallRecordDetail).toHaveBeenCalledWith('call-2'),
    );
    expect(getAiCallRecordRecording).toHaveBeenCalledWith('call-2');
    expect(getAiCallRecordDialogue).toHaveBeenCalledWith('call-2');
    expect(screen.getByText('录音与对话')).toBeTruthy();
    expect(screen.getByText('我为您安排回访。')).toBeTruthy();
    expect(screen.getByText('好的，麻烦您了。')).toBeTruthy();
    const dialogueRegion = screen.getByTestId('dialogue-scroll-region');
    expect(dialogueRegion.className).toContain('ai-call-dialogue-region');
    expect(dialogueRegion.style.maxHeight).toBe('420px');
    expect(dialogueRegion.style.overflowY).toBe('auto');
    expect(
      screen.getByText('我为您安排回访。').closest('.ai-call-dialogue-row')
        ?.className,
    ).toContain('ai-call-dialogue-row--left');
    expect(
      screen.getByText('好的，麻烦您了。').closest('.ai-call-dialogue-row')
        ?.className,
    ).toContain('ai-call-dialogue-row--right');
    expect(
      screen
        .getByTestId('follow-up-recording-player')
        .querySelector('audio')
        ?.getAttribute('controlslist'),
    ).toBe('nodownload');
  });

  it('将未接通回拨的结束状态展示为中文', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-no-answer',
        callId: 'call-no-answer',
        entryType: 'sip_callback',
        status: 'completed',
        endReason: 'callback_no_answer',
        startedAt: '2026-08-27T18:23:28+08:00',
        durationMs: 10000,
      },
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });

    render(
      <FollowUpCallDetail
        callId="call-no-answer"
        followUp={{
          id: 'follow-up-no-answer',
          source_type: 'after_call_work',
          source_call_id: 'call-source',
          source_handoff_id: null,
          scene_code: 'intro_geo',
          status: 'processing',
          follow_up_reason: '客户要求回访',
          created_at: '2026-08-27T18:04:48+08:00',
        }}
      />,
    );

    expect(await screen.findByText('未接通')).toBeTruthy();
    expect(screen.queryByText('callback_no_answer')).toBeNull();
  });
});
