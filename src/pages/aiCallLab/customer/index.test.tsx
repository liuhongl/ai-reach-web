import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import {
  AiCallBrowserRuntimeStartError,
  createAiCallBrowserSession,
  endAiCallBrowserSession,
  getAiCallBrowserSessionState,
  reportAiCallBrowserSessionEvent,
} from '@/services/ruoyi/ai-call-browser-session';
import {
  getAiCallLabDialoguePreview,
  getAiCallLabEvents,
  getAiCallLabHandoff,
  getAiCallLabPromptProfiles,
  getAiCallLabRecording,
  getAiCallLabVoiceProfiles,
} from '@/services/ruoyi/ai-call-lab';
import AiCallLabCustomerPage from './index';
import { connectAiCallLabRoom } from './livekitClient';

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  getAiCallLabDialoguePreview: jest.fn(),
  getAiCallLabEvents: jest.fn(),
  getAiCallLabHandoff: jest.fn(),
  getAiCallLabPromptProfiles: jest.fn(),
  getAiCallLabRecording: jest.fn(),
  getAiCallLabVoiceProfiles: jest.fn(),
}));

jest.mock('@/services/ruoyi/ai-call-browser-session', () => {
  const actual = jest.requireActual('@/services/ruoyi/ai-call-browser-session');
  return {
    ...actual,
    createAiCallBrowserSession: jest.fn(),
    endAiCallBrowserSession: jest.fn(),
    getAiCallBrowserSessionState: jest.fn(),
    reportAiCallBrowserSessionEvent: jest.fn(),
  };
});

jest.mock(
  './livekitClient',
  () => ({
    connectAiCallLabRoom: jest.fn(),
  }),
  { virtual: true },
);

const createSessionMock = createAiCallBrowserSession as jest.Mock;
const endSessionMock = endAiCallBrowserSession as jest.Mock;
const getSessionStateMock = getAiCallBrowserSessionState as jest.Mock;
const reportBrowserEventMock = reportAiCallBrowserSessionEvent as jest.Mock;
const getDialogueMock = getAiCallLabDialoguePreview as jest.Mock;
const getEventsMock = getAiCallLabEvents as jest.Mock;
const getHandoffMock = getAiCallLabHandoff as jest.Mock;
const getPromptProfilesMock = getAiCallLabPromptProfiles as jest.Mock;
const getRecordingMock = getAiCallLabRecording as jest.Mock;
const getVoiceProfilesMock = getAiCallLabVoiceProfiles as jest.Mock;
const connectRoomMock = connectAiCallLabRoom as jest.Mock;

describe('AiCallLabCustomerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getVoiceProfilesMock.mockResolvedValue({
      rows: [{ voice: 'Tina', displayName: '甜甜 Tina', gender: '女声' }],
      total: 1,
    });
    getPromptProfilesMock.mockResolvedValue({
      rows: [
        {
          id: 'profile-geo',
          name: 'GEO 产品介绍',
          sceneCode: 'intro_geo',
        },
      ],
      total: 1,
    });
    createSessionMock.mockResolvedValue({
      runtimeControlMode: 'legacy_local',
      callId: 'call-1',
      roomName: 'ai-call-call-1',
      model: 'qwen3.5-omni-plus-realtime',
      status: 'created',
      participantToken: 'token-1',
      livekitUrl: 'ws://127.0.0.1:7880',
    });
    endSessionMock.mockResolvedValue({ code: 200 });
    getSessionStateMock.mockResolvedValue({
      runtimeControlMode: 'legacy_local',
      callId: 'call-1',
      status: 'connected',
      metrics: { lastModelFirstAudioMs: 320 },
    });
    getRecordingMock.mockResolvedValue({
      status: 'recording',
      egressId: 'egress-1',
    });
    getHandoffMock.mockResolvedValue(null);
    getDialogueMock.mockResolvedValue({
      rows: [
        { speakerType: 'ai', text: '张总您好', segmentNo: 1 },
        { speakerType: 'customer', text: '你好', segmentNo: 2 },
      ],
    });
    getEventsMock.mockResolvedValue({
      rows: [
        { eventId: 'event-1', eventType: 'session_created' },
        { eventId: 'event-2', eventType: 'ai_audio_published' },
      ],
    });
    reportBrowserEventMock.mockResolvedValue({});
    connectRoomMock.mockResolvedValue({
      disconnect: jest.fn(),
      setMicrophoneEnabled: jest.fn(),
    });
  });

  it('loads selectable voice and business scene options', async () => {
    render(React.createElement(AiCallLabCustomerPage));

    expect(screen.getByText('AI Call 浏览器通话测试台')).toBeTruthy();
    expect(await screen.findByText('甜甜 Tina')).toBeTruthy();
    expect(screen.queryByText('甜甜 Tina / Tina')).toBeNull();
    expect(screen.getByText(/GEO 产品介绍/)).toBeTruthy();
  });

  it('shows an unavailable state instead of an endless loading button when configuration fails', async () => {
    getVoiceProfilesMock.mockRejectedValue(new Error('request timeout'));

    render(React.createElement(AiCallLabCustomerPage));

    const unavailableButton = await screen.findByRole('button', {
      name: '暂无可用配置',
    });
    expect((unavailableButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('加载配置')).toBeNull();
  });

  it('creates a browser session, refreshes observability and connects microphone', async () => {
    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({
        idempotencyKey: expect.any(String),
        voice: 'Tina',
        sceneCode: 'intro_geo',
        businessId: '',
        businessParams: { customerName: '张总' },
      });
    });
    expect(screen.getByText('AI 音频')).toBeTruthy();
    expect(screen.getByText('已发布')).toBeTruthy();
    expect(screen.getByText('首包')).toBeTruthy();
    expect(screen.getByText('张总您好')).toBeTruthy();
    expect(screen.queryByText('Call ID')).toBeNull();
    expect(screen.queryByText('诊断日志')).toBeNull();
    expect(screen.queryByText('session_created')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /调试信息/ }));

    expect(await screen.findByText('call-1')).toBeTruthy();
    expect(screen.getByText('ai-call-call-1')).toBeTruthy();
    expect(screen.getByText('qwen3.5-omni-plus-realtime')).toBeTruthy();
    expect(screen.getByText('egress-1')).toBeTruthy();
    expect(screen.getByText('session_created')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));

    await waitFor(() => {
      expect(connectRoomMock).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: 'call-1',
          participantToken: 'token-1',
          livekitUrl: 'ws://127.0.0.1:7880',
        }),
      );
      expect(reportBrowserEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: 'call-1',
          runtimeControlMode: 'legacy_local',
        }),
        { type: 'browser_ready' },
      );
    });
    expect(screen.getByText('麦克风：开')).toBeTruthy();
  });

  it('polls observability after creating a session', async () => {
    const pollingCallbacks: Array<() => void> = [];
    const setIntervalSpy = jest
      .spyOn(window, 'setInterval')
      .mockImplementation((handler: () => void, timeout?: number) => {
        if (timeout === 1500 && typeof handler === 'function') {
          pollingCallbacks.push(handler);
        }
        return {} as ReturnType<typeof window.setInterval>;
      });
    const clearIntervalSpy = jest
      .spyOn(window, 'clearInterval')
      .mockImplementation(() => undefined);

    try {
      render(React.createElement(AiCallLabCustomerPage));

      fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

      await waitFor(() => {
        expect(getSessionStateMock).toHaveBeenCalledWith(
          expect.objectContaining({ callId: 'call-1' }),
        );
      });
      expect(pollingCallbacks).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /刷新观测/ })).toBeNull();

      getSessionStateMock.mockClear();
      await act(async () => {
        pollingCallbacks[0]();
      });

      await waitFor(() => {
        expect(getSessionStateMock).toHaveBeenCalledWith(
          expect.objectContaining({ callId: 'call-1' }),
        );
      });
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('prevents creating another session while the current session is active', async () => {
    render(React.createElement(AiCallLabCustomerPage));

    await screen.findByRole('button', {
      name: /创建会话/,
    });
    await screen.findByText(/甜甜 Tina/);
    fireEvent.click(screen.getByRole('button', { name: /创建会话/ }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledTimes(1);
    });
    const activeCreateButton = screen.getByRole('button', {
      name: /创建会话/,
    });
    expect(activeCreateButton.hasAttribute('disabled')).toBe(true);

    fireEvent.click(activeCreateButton);
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the same start idempotency key after an unknown request failure', async () => {
    createSessionMock.mockRejectedValueOnce(new Error('network response lost'));

    render(React.createElement(AiCallLabCustomerPage));

    const createButton = await screen.findByRole('button', {
      name: /创建会话/,
    });
    fireEvent.click(createButton);
    expect(await screen.findByText('会话创建失败')).toBeTruthy();

    fireEvent.click(createButton);
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(2));

    expect(createSessionMock.mock.calls[0][0].idempotencyKey).toBe(
      createSessionMock.mock.calls[1][0].idempotencyKey,
    );
  });

  it('keeps an accepted owner call visible when readiness polling fails', async () => {
    createSessionMock.mockRejectedValueOnce(
      new AiCallBrowserRuntimeStartError(
        'call-accepted',
        new Error('bootstrap unavailable'),
      ),
    );

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));
    expect(
      await screen.findByText('会话已受理，但运行时尚未就绪'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /调试信息/ }));
    expect(await screen.findByText('call-accepted')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /结束会话/ }).hasAttribute('disabled'),
    ).toBe(false);
    expect(
      screen
        .getByRole('button', { name: /连接麦克风/ })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('polls only bootstrap facts for owner sessions and shows cleanup attention', async () => {
    createSessionMock.mockResolvedValueOnce({
      runtimeControlMode: 'owner_command_v1',
      callId: 'call-owner',
      roomName: 'ai-call-call-owner',
      status: 'ready',
      participantToken: 'owner-token',
      livekitUrl: 'wss://livekit.test',
    });
    getSessionStateMock.mockResolvedValueOnce({
      runtimeControlMode: 'owner_command_v1',
      callId: 'call-owner',
      roomName: 'ai-call-call-owner',
      status: 'failed',
      runtimePhase: 'terminal',
      resourceCleanupStatus: 'attention_required',
      resourceCleanupError: 'Provider query timed out',
    });

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

    expect(await screen.findByText('资源清理需人工处理')).toBeTruthy();
    expect(screen.getByText('Provider query timed out')).toBeTruthy();
    expect(getSessionStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: 'call-owner',
        runtimeControlMode: 'owner_command_v1',
      }),
    );
    expect(getRecordingMock).not.toHaveBeenCalled();
    expect(getHandoffMock).not.toHaveBeenCalled();
    expect(getDialogueMock).not.toHaveBeenCalled();
    expect(getEventsMock).not.toHaveBeenCalled();
  });

  it('disables duplicate owner ending after END_CALL is accepted', async () => {
    const ownerSession = {
      runtimeControlMode: 'owner_command_v1' as const,
      callId: 'call-owner',
      roomName: 'ai-call-call-owner',
      status: 'ready',
      runtimePhase: 'ready' as const,
      participantToken: 'owner-token',
      livekitUrl: 'wss://livekit.test',
    };
    createSessionMock.mockResolvedValueOnce(ownerSession);
    getSessionStateMock
      .mockResolvedValueOnce(ownerSession)
      .mockRejectedValueOnce(new Error('bootstrap temporarily unavailable'));

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));
    await screen.findByText('ready');
    fireEvent.click(screen.getByRole('button', { name: /结束会话/ }));

    expect(await screen.findByText('结束请求已受理')).toBeTruthy();
    expect(screen.getByText('ending')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /结束会话/ }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('stops automatic polling and offers a manual refresh for a terminal session', async () => {
    const setIntervalSpy = jest.spyOn(window, 'setInterval');
    createSessionMock.mockResolvedValueOnce({
      runtimeControlMode: 'legacy_local',
      callId: 'call-1',
      roomName: 'ai-call-call-1',
      status: 'completed',
      participantToken: 'token-1',
      livekitUrl: 'ws://127.0.0.1:7880',
    });
    getSessionStateMock.mockResolvedValueOnce({
      runtimeControlMode: 'legacy_local',
      callId: 'call-1',
      status: 'completed',
    });

    try {
      render(React.createElement(AiCallLabCustomerPage));

      await screen.findByText(/甜甜 Tina/);
      expect(screen.queryByRole('button', { name: /刷新结果/ })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

      expect(
        await screen.findByRole('button', { name: /刷新结果/ }),
      ).toBeTruthy();
      expect(
        setIntervalSpy.mock.calls.some(([, timeout]) => timeout === 1500),
      ).toBe(false);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('shows the recording failure reason', async () => {
    getRecordingMock.mockResolvedValueOnce({
      status: 'failed',
      failureMessage: '未找到可用的OSS配置',
    });

    render(React.createElement(AiCallLabCustomerPage));

    await screen.findByText(/甜甜 Tina/);
    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

    expect(await screen.findByText('录音失败原因')).toBeTruthy();
    expect(screen.getByText('未找到可用的OSS配置')).toBeTruthy();
  });

  it('shows an inline player when the recording is ready', async () => {
    getRecordingMock.mockResolvedValueOnce({
      status: 'completed',
      durationMs: 12_300,
      playUrl: 'https://files.test/call-1.mp3?signature=ready',
    });

    render(React.createElement(AiCallLabCustomerPage));

    await screen.findByText(/甜甜 Tina/);
    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));

    const player = await screen.findByLabelText('播放通话录音');
    expect(player.getAttribute('src')).toBe(
      'https://files.test/call-1.mp3?signature=ready',
    );
  });

  it('disconnects locally and ends the backend session', async () => {
    const disconnectMock = jest.fn();
    connectRoomMock.mockResolvedValueOnce({
      disconnect: disconnectMock,
      setMicrophoneEnabled: jest.fn(),
    });
    getSessionStateMock
      .mockResolvedValueOnce({
        runtimeControlMode: 'legacy_local',
        callId: 'call-1',
        status: 'connected',
      })
      .mockResolvedValueOnce({
        runtimeControlMode: 'legacy_local',
        callId: 'call-1',
        status: 'completed',
      });

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));
    await screen.findByText('connected');
    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));
    await screen.findByText('麦克风：开');

    fireEvent.click(screen.getByRole('button', { name: /结束会话/ }));

    await waitFor(() => {
      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(endSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
        expect.any(String),
      );
      expect(screen.getByText('completed')).toBeTruthy();
    });
    expect(
      screen.getByRole('button', { name: /结束会话/ }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('keeps backend ending retryable when the end request fails', async () => {
    const disconnectMock = jest.fn();
    connectRoomMock.mockResolvedValueOnce({
      disconnect: disconnectMock,
      setMicrophoneEnabled: jest.fn(),
    });
    endSessionMock.mockRejectedValueOnce(new Error('network error'));

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));
    await screen.findByText('connected');
    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));
    await screen.findByText('麦克风：开');

    fireEvent.click(screen.getByRole('button', { name: /结束会话/ }));

    await waitFor(() => {
      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(endSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
        expect.any(String),
      );
    });
    expect(screen.getByText('麦克风：未连接')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /结束会话/ }).hasAttribute('disabled'),
    ).toBe(false);
    expect(
      await screen.findByText('本地已断开，但后端会话结束失败，请重试'),
    ).toBeTruthy();

    const firstDedupeKey = endSessionMock.mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: /结束会话/ }));
    await waitFor(() => expect(endSessionMock).toHaveBeenCalledTimes(2));
    expect(endSessionMock.mock.calls[1][1]).toBe(firstDedupeKey);
  });

  it('ends the backend session when LiveKit joining fails', async () => {
    connectRoomMock.mockRejectedValueOnce(new Error('LiveKit unavailable'));
    getSessionStateMock
      .mockResolvedValueOnce({
        runtimeControlMode: 'legacy_local',
        callId: 'call-1',
        status: 'ready',
      })
      .mockResolvedValueOnce({
        runtimeControlMode: 'legacy_local',
        callId: 'call-1',
        status: 'completed',
      });

    render(React.createElement(AiCallLabCustomerPage));

    await screen.findByText(/甜甜 Tina/);
    await waitFor(() => {
      expect(document.querySelector('.ant-spin-spinning')).toBeNull();
    });
    const createButton = screen.getByRole('button', { name: /创建会话/ });
    expect(createButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(createButton);
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getSessionStateMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));

    await waitFor(() => {
      expect(endSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
        expect.any(String),
      );
      expect(screen.getByText('completed')).toBeTruthy();
    });
    expect(screen.getByText('麦克风：未连接')).toBeTruthy();
  });

  it('reports owner join rollback as accepted instead of completed cleanup', async () => {
    const ownerSession = {
      runtimeControlMode: 'owner_command_v1' as const,
      callId: 'call-owner',
      roomName: 'ai-call-call-owner',
      status: 'ready',
      runtimePhase: 'ready' as const,
      participantToken: 'owner-token',
      livekitUrl: 'wss://livekit.test',
    };
    createSessionMock.mockResolvedValueOnce(ownerSession);
    getSessionStateMock
      .mockResolvedValueOnce(ownerSession)
      .mockResolvedValueOnce({
        ...ownerSession,
        status: 'ending',
        runtimePhase: 'ending',
      });
    connectRoomMock.mockRejectedValueOnce(new Error('LiveKit unavailable'));

    render(React.createElement(AiCallLabCustomerPage));

    fireEvent.click(await screen.findByRole('button', { name: /创建会话/ }));
    await screen.findByText('ready');
    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));

    expect(
      await screen.findByText(
        '麦克风连接失败：LiveKit unavailable；结束请求已提交',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/后端会话已回收/)).toBeNull();
  });

  it('keeps manual ending available when join rollback cannot end the backend session', async () => {
    connectRoomMock.mockRejectedValueOnce(new Error('LiveKit unavailable'));
    endSessionMock.mockRejectedValueOnce(new Error('end failed'));
    getSessionStateMock.mockResolvedValueOnce({
      runtimeControlMode: 'legacy_local',
      callId: 'call-1',
      status: 'ready',
    });

    render(React.createElement(AiCallLabCustomerPage));

    await screen.findByText(/甜甜 Tina/);
    await waitFor(() => {
      expect(document.querySelector('.ant-spin-spinning')).toBeNull();
    });
    const createButton = screen.getByRole('button', { name: /创建会话/ });
    expect(createButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(createButton);
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getSessionStateMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /连接麦克风/ }));

    await waitFor(() => {
      expect(endSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
        expect.any(String),
      );
    });
    expect(
      screen.getByRole('button', { name: /结束会话/ }).hasAttribute('disabled'),
    ).toBe(false);
    expect(
      await screen.findByText(/后端会话回收失败，请点击“结束会话”重试/),
    ).toBeTruthy();
  });
});
