import {
  AudioMutedOutlined,
  AudioOutlined,
  BugOutlined,
  DisconnectOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Drawer,
  Empty,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ListPage,
  ListStack,
  TableCard,
} from '@/components/ListLayout';
import {
  AiCallBrowserRuntimeStartError,
  type AiCallBrowserSession,
  createAiCallBrowserSession,
  endAiCallBrowserSession,
  getAiCallBrowserSessionState,
  reportAiCallBrowserSessionEvent,
} from '@/services/ruoyi/ai-call-browser-session';
import {
  type AiCallLabDialogueSegment,
  type AiCallLabEvent,
  type AiCallLabHandoff,
  type AiCallLabPromptProfile,
  type AiCallLabRecording,
  type AiCallLabVoiceProfile,
  getAiCallLabDialoguePreview,
  getAiCallLabEvents,
  getAiCallLabHandoff,
  getAiCallLabPromptProfiles,
  getAiCallLabRecording,
  getAiCallLabVoiceProfiles,
} from '@/services/ruoyi/ai-call-lab';
import {
  type AiCallLabRoomConnection,
  connectAiCallLabRoom,
} from './livekitClient';
import './index.css';

const getEventName = (item: AiCallLabEvent) =>
  item.eventType || item.type || item.eventId || '-';

const TERMINAL_SESSION_STATUSES = new Set(['completed', 'failed']);
let clientOperationSequence = 0;

const createClientOperationKey = (operation: string) => {
  clientOperationSequence += 1;
  return `${operation}:${Date.now().toString(36)}:${clientOperationSequence.toString(36)}`;
};

const AiCallLabCustomerPage = () => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [voiceProfiles, setVoiceProfiles] = useState<AiCallLabVoiceProfile[]>(
    [],
  );
  const [promptProfiles, setPromptProfiles] = useState<
    AiCallLabPromptProfile[]
  >([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedSceneCode, setSelectedSceneCode] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [businessParamsText, setBusinessParamsText] = useState(
    '{\n  "customerName": "张总"\n}',
  );
  const [session, setSession] = useState<AiCallBrowserSession | null>(null);
  const [recording, setRecording] = useState<AiCallLabRecording | null>(null);
  const [handoff, setHandoff] = useState<AiCallLabHandoff | null>(null);
  const [dialogueRows, setDialogueRows] = useState<AiCallLabDialogueSegment[]>(
    [],
  );
  const [eventRows, setEventRows] = useState<AiCallLabEvent[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const roomConnectionRef = useRef<AiCallLabRoomConnection | null>(null);
  const sessionRef = useRef<AiCallBrowserSession | null>(null);
  const startIdempotencyKeyRef = useRef<string | null>(null);
  const endDedupeKeyRef = useRef<{ callId: string; key: string } | null>(null);

  const replaceSession = useCallback((next: AiCallBrowserSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const getEndDedupeKey = useCallback((callId: string) => {
    if (endDedupeKeyRef.current?.callId === callId) {
      return endDedupeKeyRef.current.key;
    }
    const key = createClientOperationKey(`web:end:${callId}`);
    endDedupeKeyRef.current = { callId, key };
    return key;
  }, []);

  const configReady = Boolean(selectedVoice && selectedSceneCode);
  const sessionTerminal = Boolean(
    (session?.status && TERMINAL_SESSION_STATUSES.has(session.status)) ||
      session?.runtimePhase === 'terminal',
  );
  const sessionEnding = Boolean(
    session?.status === 'ending' || session?.runtimePhase === 'ending',
  );
  const sessionActive = Boolean(session && !sessionTerminal);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [voiceResult, promptResult] = await Promise.all([
        getAiCallLabVoiceProfiles(),
        getAiCallLabPromptProfiles(),
      ]);
      setVoiceProfiles(voiceResult.rows);
      setPromptProfiles(promptResult.rows);
      setSelectedVoice((prev) => prev || voiceResult.rows[0]?.voice || '');
      setSelectedSceneCode(
        (prev) => prev || promptResult.rows[0]?.sceneCode || '',
      );
    } catch {
      setVoiceProfiles([]);
      setPromptProfiles([]);
      messageApi.error('通话配置加载失败');
    } finally {
      setConfigLoading(false);
    }
  }, [messageApi]);

  const refreshObservability = useCallback(
    async (targetSession?: AiCallBrowserSession) => {
      const currentSession = targetSession || sessionRef.current;
      if (!currentSession) return;
      setObservabilityLoading(true);
      try {
        if (currentSession.runtimeControlMode === 'owner_command_v1') {
          replaceSession({
            ...currentSession,
            ...(await getAiCallBrowserSessionState(currentSession)),
          });
          return;
        }
        const [
          nextSession,
          nextRecording,
          nextHandoff,
          dialogueResult,
          eventResult,
        ] = await Promise.all([
          getAiCallBrowserSessionState(currentSession),
          getAiCallLabRecording(currentSession.callId),
          getAiCallLabHandoff(currentSession.callId),
          getAiCallLabDialoguePreview(currentSession.callId),
          getAiCallLabEvents(currentSession.callId),
        ]);
        replaceSession({ ...currentSession, ...nextSession });
        setRecording(nextRecording);
        setHandoff(nextHandoff);
        setDialogueRows(dialogueResult.rows);
        setEventRows(eventResult.rows);
      } catch {
        messageApi.error('运行观测刷新失败');
      } finally {
        setObservabilityLoading(false);
      }
    },
    [messageApi, replaceSession],
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(
    () => () => {
      void roomConnectionRef.current?.disconnect();
    },
    [],
  );

  useEffect(() => {
    const callId = session?.callId;
    if (!callId || sessionTerminal || ending) return undefined;
    const timer = window.setInterval(() => {
      const currentSession = sessionRef.current;
      if (currentSession) void refreshObservability(currentSession);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [ending, refreshObservability, session?.callId, sessionTerminal]);

  const handleCreateSession = async () => {
    let businessParams: Record<string, unknown> = {};
    try {
      businessParams = businessParamsText.trim()
        ? JSON.parse(businessParamsText)
        : {};
    } catch {
      messageApi.error('业务参数不是有效 JSON');
      return;
    }

    setCreating(true);
    try {
      const idempotencyKey =
        startIdempotencyKeyRef.current || createClientOperationKey('web:start');
      startIdempotencyKeyRef.current = idempotencyKey;
      const nextSession = await createAiCallBrowserSession({
        idempotencyKey,
        voice: selectedVoice,
        sceneCode: selectedSceneCode,
        businessId: businessId.trim(),
        businessParams,
      });
      startIdempotencyKeyRef.current = null;
      endDedupeKeyRef.current = null;
      replaceSession(nextSession);
      setRecording(null);
      setHandoff(null);
      setDialogueRows([]);
      setEventRows([]);
      await refreshObservability(nextSession);
    } catch (error) {
      if (error instanceof AiCallBrowserRuntimeStartError) {
        startIdempotencyKeyRef.current = null;
        endDedupeKeyRef.current = null;
        const acceptedSession: AiCallBrowserSession = {
          runtimeControlMode: 'owner_command_v1',
          callId: error.callId,
          status: 'starting',
          runtimePhase: 'starting',
        };
        replaceSession(acceptedSession);
        setRecording(null);
        setHandoff(null);
        setDialogueRows([]);
        setEventRows([]);
        messageApi.warning('会话已受理，但运行时尚未就绪');
      } else {
        messageApi.error('会话创建失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleConnectMicrophone = async () => {
    if (!session?.participantToken || !session.livekitUrl) {
      messageApi.warning('请先创建会话');
      return;
    }
    setConnecting(true);
    try {
      const connection = await connectAiCallLabRoom(session);
      roomConnectionRef.current = connection;
      setRoomConnected(true);
      setMicrophoneEnabled(true);
      await reportAiCallBrowserSessionEvent(session, {
        type: 'browser_ready',
      });
    } catch (error) {
      const connection = roomConnectionRef.current;
      roomConnectionRef.current = null;
      setRoomConnected(false);
      setMicrophoneEnabled(false);
      try {
        await connection?.disconnect();
      } catch {
        // LiveKit 客户端已尽力清理，继续收口后端 Session。
      }
      const errorMessage = error instanceof Error ? error.message : '';
      try {
        await endAiCallBrowserSession(session, getEndDedupeKey(session.callId));
        if (session.runtimeControlMode === 'owner_command_v1') {
          replaceSession({
            ...session,
            status: 'ending',
            runtimePhase: 'ending',
          });
        }
        await refreshObservability(session);
        const rollbackResult =
          session.runtimeControlMode === 'owner_command_v1'
            ? '结束请求已提交'
            : '后端会话已回收';
        messageApi.error(
          errorMessage
            ? `麦克风连接失败：${errorMessage}；${rollbackResult}`
            : `麦克风连接失败，${rollbackResult}`,
        );
      } catch {
        messageApi.error(
          errorMessage
            ? `麦克风连接失败：${errorMessage}；后端会话回收失败，请点击“结束会话”重试`
            : '麦克风连接失败，后端会话回收失败，请点击“结束会话”重试',
        );
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleToggleMicrophone = async () => {
    if (!roomConnectionRef.current || !session) return;
    const nextEnabled = !microphoneEnabled;
    await roomConnectionRef.current.setMicrophoneEnabled(nextEnabled);
    setMicrophoneEnabled(nextEnabled);
    await reportAiCallBrowserSessionEvent(session, {
      type: nextEnabled
        ? 'browser_microphone_unmuted'
        : 'browser_microphone_muted',
    });
  };

  const handleEndSession = async () => {
    if (!session || sessionTerminal || sessionEnding) return;
    const currentSession = session;
    const connection = roomConnectionRef.current;
    roomConnectionRef.current = null;
    setRoomConnected(false);
    setMicrophoneEnabled(false);
    setEnding(true);
    try {
      await connection?.disconnect();
    } catch {
      messageApi.warning('本地连接断开异常，正在继续结束后端会话');
    }
    try {
      await endAiCallBrowserSession(
        currentSession,
        getEndDedupeKey(currentSession.callId),
      );
      if (currentSession.runtimeControlMode === 'owner_command_v1') {
        replaceSession({
          ...currentSession,
          status: 'ending',
          runtimePhase: 'ending',
        });
      }
      await refreshObservability(currentSession);
      messageApi.success(
        currentSession.runtimeControlMode === 'owner_command_v1'
          ? '结束请求已受理'
          : '会话已结束',
      );
    } catch {
      messageApi.error('本地已断开，但后端会话结束失败，请重试');
    } finally {
      setEnding(false);
    }
  };

  const statusTagColor = session?.status === 'connected' ? 'success' : 'blue';
  const firstAudioMs = session?.metrics?.lastModelFirstAudioMs;
  const firstAudioText =
    typeof firstAudioMs === 'number' || typeof firstAudioMs === 'string'
      ? `${firstAudioMs} ms`
      : '-';
  const microphoneText = roomConnected
    ? microphoneEnabled
      ? '麦克风：开'
      : '麦克风：关'
    : '麦克风：未连接';
  const hasAiAudioPublished = eventRows.some(
    (item) => getEventName(item) === 'ai_audio_published',
  );
  const hasModelAudioDelta = eventRows.some(
    (item) => getEventName(item) === 'model_audio_delta',
  );
  const aiAudioText = hasAiAudioPublished
    ? '已发布'
    : hasModelAudioDelta
      ? '生成中'
      : '-';
  const hasRecordingOrHandoff = Boolean(recording || handoff);
  const cleanupStatusText =
    session?.resourceCleanupStatus === 'reconciling'
      ? '资源清理中'
      : session?.resourceCleanupStatus === 'attention_required'
        ? '资源清理需人工处理'
        : session?.resourceCleanupStatus === 'clean'
          ? '资源已清理'
          : null;

  return (
    <ListPage
      className="ai-call-lab-customer-page"
      title="AI Call 浏览器通话测试台"
    >
      {messageContextHolder}
      <ListStack>
        <div className="ai-call-lab-page-header">
          <Typography.Title level={3} style={{ margin: 0 }}>
            AI Call 浏览器通话测试台
          </Typography.Title>
          <Space>
            <Button
              icon={<BugOutlined />}
              onClick={() => setDebugDrawerOpen(true)}
            >
              调试信息
            </Button>
            {sessionTerminal && (
              <Button
                icon={<ReloadOutlined />}
                loading={observabilityLoading}
                onClick={() => void refreshObservability()}
              >
                刷新结果
              </Button>
            )}
          </Space>
        </div>

        <div className="ai-call-lab-customer-grid">
          <TableCard
            title="会话配置"
            extra={
              <Button
                icon={<ReloadOutlined />}
                loading={configLoading}
                onClick={() => void loadConfig()}
              >
                刷新
              </Button>
            }
          >
            <Spin spinning={configLoading}>
              <div className="recov-table-card-content ai-call-lab-form">
                <div className="ai-call-lab-field">
                  <Typography.Text strong>音色</Typography.Text>
                  <Select
                    value={selectedVoice || undefined}
                    options={voiceProfiles.map((item) => ({
                      value: item.voice,
                      label: item.displayName,
                    }))}
                    style={{ width: '100%' }}
                    onChange={setSelectedVoice}
                  />
                </div>
                <div className="ai-call-lab-field">
                  <Typography.Text strong>业务场景</Typography.Text>
                  <Select
                    value={selectedSceneCode || undefined}
                    options={promptProfiles.map((item) => ({
                      value: item.sceneCode,
                      label: `${item.name} / ${item.sceneCode}`,
                    }))}
                    style={{ width: '100%' }}
                    onChange={setSelectedSceneCode}
                  />
                </div>
                <div className="ai-call-lab-field">
                  <Typography.Text strong>业务 ID</Typography.Text>
                  <Input
                    value={businessId}
                    onChange={(event) => setBusinessId(event.target.value)}
                  />
                </div>
                <div className="ai-call-lab-field">
                  <Typography.Text strong>业务参数</Typography.Text>
                  <Input.TextArea
                    value={businessParamsText}
                    rows={5}
                    onChange={(event) =>
                      setBusinessParamsText(event.target.value)
                    }
                  />
                </div>

                {configReady ? (
                  <Button
                    type="primary"
                    icon={<PhoneOutlined />}
                    block
                    loading={creating}
                    disabled={sessionActive}
                    onClick={() => void handleCreateSession()}
                  >
                    创建会话
                  </Button>
                ) : (
                  <Button block disabled>
                    暂无可用配置
                  </Button>
                )}

                <Space size={8} wrap>
                  <Button
                    icon={<AudioOutlined />}
                    loading={connecting}
                    disabled={
                      !session?.participantToken ||
                      !session.livekitUrl ||
                      roomConnected ||
                      sessionEnding ||
                      sessionTerminal
                    }
                    onClick={() => void handleConnectMicrophone()}
                  >
                    连接麦克风
                  </Button>
                  <Button
                    icon={
                      microphoneEnabled ? (
                        <AudioMutedOutlined />
                      ) : (
                        <AudioOutlined />
                      )
                    }
                    disabled={!roomConnected}
                    onClick={() => void handleToggleMicrophone()}
                  >
                    {microphoneEnabled ? '静音' : '取消静音'}
                  </Button>
                  <Button
                    icon={<DisconnectOutlined />}
                    loading={ending}
                    disabled={!session || sessionEnding || sessionTerminal}
                    onClick={() => void handleEndSession()}
                  >
                    结束会话
                  </Button>
                </Space>
              </div>
            </Spin>
          </TableCard>

          <div className="ai-call-lab-observability">
            <TableCard
              title="运行态"
              extra={<Tag color={statusTagColor}>{session?.status || '-'}</Tag>}
            >
              <Spin spinning={observabilityLoading}>
                <div className="ai-call-lab-state-grid">
                  <MetricItem label="首包" value={firstAudioText} />
                  <MetricItem label="浏览器" value={microphoneText} />
                  <MetricItem label="AI 音频" value={aiAudioText} />
                  {cleanupStatusText && (
                    <MetricItem label="资源清理" value={cleanupStatusText} />
                  )}
                  {session?.resourceCleanupError && (
                    <MetricItem
                      label="清理告警"
                      value={session.resourceCleanupError}
                    />
                  )}
                  {session?.failureMessage && (
                    <MetricItem
                      label="失败原因"
                      value={session.failureMessage}
                    />
                  )}
                </div>
              </Spin>
            </TableCard>

            <TableCard title="对话片段">
              <RecordList emptyText="暂无对话片段">
                {dialogueRows.map((item) => (
                  <div
                    className="ai-call-lab-record-row"
                    key={`${item.segmentNo ?? item.startedAt ?? item.text ?? ''}-${item.speakerType}`}
                  >
                    <Tag>{item.speakerType || '-'}</Tag>
                    <Typography.Text>{item.text || '-'}</Typography.Text>
                  </div>
                ))}
              </RecordList>
            </TableCard>

            <TableCard title="录音与转人工">
              {hasRecordingOrHandoff ? (
                <div className="ai-call-lab-state-grid">
                  {recording && (
                    <MetricItem
                      label="录音状态"
                      value={recording.status || '-'}
                    />
                  )}
                  {recording?.failureMessage && (
                    <MetricItem
                      label="录音失败原因"
                      value={recording.failureMessage}
                    />
                  )}
                  {recording?.playUrl && (
                    <MetricItem
                      label="录音"
                      value={
                        // biome-ignore lint/a11y/useMediaCaption: 通话录音当前没有独立字幕轨道。
                        <audio
                          aria-label="播放通话录音"
                          className="ai-call-lab-recording-player"
                          controls
                          preload="metadata"
                          src={recording.playUrl}
                        />
                      }
                    />
                  )}
                  {handoff && (
                    <MetricItem
                      label="转人工状态"
                      value={handoff.status || '-'}
                    />
                  )}
                  {handoff?.humanAgentIdentity && (
                    <MetricItem
                      label="转人工坐席"
                      value={handoff.humanAgentIdentity}
                    />
                  )}
                  {handoff?.requestReason && (
                    <MetricItem
                      label="转人工原因"
                      value={handoff.requestReason}
                    />
                  )}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无录音或转人工结果"
                />
              )}
            </TableCard>
          </div>
        </div>
      </ListStack>

      <Drawer
        title="调试信息"
        open={debugDrawerOpen}
        size={520}
        destroyOnHidden
        onClose={() => setDebugDrawerOpen(false)}
      >
        <div className="ai-call-lab-debug-content">
          <div className="ai-call-lab-state-grid ai-call-lab-debug-grid">
            <MetricItem label="Call ID" value={session?.callId || '-'} />
            <MetricItem label="房间" value={session?.roomName || '-'} />
            <MetricItem label="模型" value={session?.model || '-'} />
            <MetricItem
              label="运行时模式"
              value={session?.runtimeControlMode || '-'}
            />
            <MetricItem label="Egress ID" value={recording?.egressId || '-'} />
            <MetricItem
              label="原始录音地址"
              value={recording?.playUrl || '-'}
            />
          </div>

          <div className="ai-call-lab-debug-events">
            <Typography.Title level={5}>原始事件</Typography.Title>
            <RecordList emptyText="暂无事件">
              {eventRows.map((item) => {
                const eventName = getEventName(item);
                return (
                  <div
                    className="ai-call-lab-record-row"
                    key={
                      item.eventId ||
                      `${eventName}-${item.eventTime || item.timestamp || item.source || ''}`
                    }
                  >
                    <Tag color="geekblue">{eventName}</Tag>
                    <Typography.Text type="secondary">
                      {item.eventTime || item.timestamp || item.source || '-'}
                    </Typography.Text>
                  </div>
                );
              })}
            </RecordList>
          </div>
        </div>
      </Drawer>
    </ListPage>
  );
};

const MetricItem = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="ai-call-lab-metric">
    <Typography.Text type="secondary">{label}</Typography.Text>
    <Typography.Text strong ellipsis={{ tooltip: String(value || '') }}>
      {value}
    </Typography.Text>
  </div>
);

const RecordList = ({
  children,
  emptyText,
}: {
  children: React.ReactNode[];
  emptyText: string;
}) => {
  if (!children.length) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
    );
  }
  return <div className="ai-call-lab-record-list">{children}</div>;
};

export default AiCallLabCustomerPage;
