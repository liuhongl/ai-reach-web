import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import CallRecordDetailContent from './CallRecordDetailContent';
import {
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordHandoffs,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
} from './service';

jest.mock('./service', () => ({
  getAiCallRecordDetail: jest.fn(),
  getAiCallRecordDialogue: jest.fn(),
  getAiCallRecordHandoffs: jest.fn(),
  getAiCallRecordRecording: jest.fn(),
  getAiCallRecordSemanticAnalysis: jest.fn(),
}));

void React.createElement;

describe('CallRecordDetailContent', () => {
  it('将任务关联的 Web 记录标记为 Web 接听', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-web',
        callId: 'call-web',
        taskId: 'task-web',
        entryType: 'web',
        status: 'completed',
        startedAt: '2026-08-06T16:00:00+08:00',
      },
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });

    render(<CallRecordDetailContent callId="call-web" />);

    expect(await screen.findByText('Web 接听')).toBeTruthy();
  });

  it('展示录音和对话，并将分析状态展示为中文', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-1',
        callId: 'call-1',
        entryType: 'outbound',
        status: 'completed',
        startedAt: '2026-08-05T16:52:30+08:00',
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisRetryCount: 0,
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'recording-1',
      callId: 'call-1',
      status: 'completed',
      playUrl: 'https://example.com/call-1.mp3',
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'segment-1',
          callId: 'call-1',
          segmentNo: 1,
          speakerType: 'customer',
          text: '我想了解收费方式。',
          segmentStatus: 'final',
        },
        {
          id: 'segment-2',
          callId: 'call-1',
          segmentNo: 2,
          speakerType: 'ai',
          text: '我给您介绍一下方案。',
          segmentStatus: 'final',
        },
      ],
      total: 1,
    });
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });

    render(<CallRecordDetailContent callId="call-1" />);

    expect(await screen.findByText('分析状态：分析成功')).toBeTruthy();
    await waitFor(() =>
      expect(getAiCallRecordDetail).toHaveBeenCalledWith('call-1'),
    );
    expect(getAiCallRecordRecording).toHaveBeenCalledWith('call-1');
    expect(getAiCallRecordDialogue).toHaveBeenCalledWith('call-1');
    expect(screen.getByText('录音与对话')).toBeTruthy();
    expect(screen.getByText('我想了解收费方式。')).toBeTruthy();
    expect(screen.getByText('我给您介绍一下方案。')).toBeTruthy();
    expect(screen.getByTestId('dialogue-scroll-region').className).toContain(
      'ai-call-dialogue-region',
    );
    expect(
      screen.getByText('我想了解收费方式。').closest('.ai-call-dialogue-row')
        ?.className,
    ).toContain('ai-call-dialogue-row--right');
    expect(
      screen
        .getByTestId('recording-player')
        .querySelector('audio')
        ?.getAttribute('controlslist'),
    ).toBe('nodownload');
  });

  it('用中文展示业务场景、浏览器结束原因和结构化分析内容', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-2',
        callId: 'call-2',
        entryType: 'web',
        taskId: 'task-2',
        sceneCode: 'intro_geo',
        status: 'completed',
        endReason: 'browser_connection_failed',
        startedAt: '2026-08-07T22:04:02+08:00',
      },
      executionConfig: { sceneCode: 'intro_geo' },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-2',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary: '客户询问了试用方案。',
        feedback_type: '中性',
        follow_up: { required: false, consent: 'missing', confidence: 'low' },
      },
      analysisRetryCount: 0,
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });

    render(<CallRecordDetailContent callId="call-2" />);

    expect(await screen.findAllByText('GEO 产品介绍')).toHaveLength(2);
    expect(screen.getByText('浏览器连接失败')).toBeTruthy();
    expect(screen.getByText('客户询问了试用方案。')).toBeTruthy();
    expect(screen.getByText('AI 建议：无需跟进')).toBeTruthy();
  });
});
