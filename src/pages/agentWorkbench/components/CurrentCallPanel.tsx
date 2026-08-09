import {
  AudioMutedOutlined,
  AudioOutlined,
  PhoneOutlined,
  SoundOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Flex,
  Modal,
  Select,
  Tag,
  Typography,
} from 'antd';
import * as React from 'react';
import { useEffect, useState } from 'react';
import type {
  AgentCallConnectionStage,
  AgentCallPhase,
  AgentNetworkQuality,
} from '../hooks/useAgentCall';
import './CurrentCallPanel.css';

const { Text } = Typography;

type AudioDevice = { label: string; value: string };

export type CurrentCallPanelProps = {
  phase: AgentCallPhase;
  connectionStage: AgentCallConnectionStage;
  microphoneEnabled: boolean;
  remoteAudioReady: boolean;
  networkQuality: AgentNetworkQuality;
  errorMessage?: string;
  endConfirmDescription?: string;
  onToggleMicrophone: () => void | Promise<void>;
  onSwitchAudioInput: (deviceId: string) => void | Promise<void>;
  onEndCall: () => void | Promise<void>;
};

const phaseLabel: Record<AgentCallPhase, string> = {
  idle: '等待接听',
  connecting: '正在接入',
  connected: '通话中',
  reconnecting: '网络重连中',
  ending: '正在结束',
  ended: '通话已结束',
  wrap_up_quick: '进入话后处理',
  error: '接入异常',
};

const qualityLabel: Record<AgentNetworkQuality, string> = {
  excellent: '优秀',
  good: '良好',
  poor: '较差',
  lost: '已断开',
  unknown: '检测中',
};

const connectionStageLabel: Record<AgentCallConnectionStage, string> = {
  idle: '等待接入',
  livekit_connecting: '正在连接通话房间',
  livekit_connected: '通话房间已连接',
  microphone_publishing: '正在发布麦克风',
  microphone_published: '麦克风已发布',
  media_ready_reporting: '正在确认坐席就绪',
  connected: '媒体接入完成',
};

const CurrentCallPanel = ({
  phase,
  connectionStage,
  microphoneEnabled,
  remoteAudioReady,
  networkQuality,
  errorMessage,
  endConfirmDescription = '结束后客户将退出本次通话，坐席进入快速话后处理。该操作不可撤销。',
  onToggleMicrophone,
  onSwitchAudioInput,
  onEndCall,
}: CurrentCallPanelProps) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const active = ['connecting', 'connected', 'reconnecting'].includes(phase);

  useEffect(() => {
    if (!active || !navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      setDevices(
        allDevices
          .filter((device) => device.kind === 'audioinput')
          .map((device, index) => ({
            value: device.deviceId,
            label: device.label || `麦克风 ${index + 1}`,
          })),
      );
    });
  }, [active]);

  if (phase === 'idle') {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无进行中的通话"
      />
    );
  }

  return (
    <div className="agent-current-call">
      {errorMessage ? (
        <Alert type="error" showIcon title={errorMessage} />
      ) : null}
      <div className="agent-current-call-status">
        <span className="agent-current-call-icon">
          <PhoneOutlined />
        </span>
        <div>
          <Text strong>{phaseLabel[phase]}</Text>
          <Flex gap="small" wrap className="agent-current-call-tags">
            <Tag color={connectionStage === 'connected' ? 'success' : 'blue'}>
              {connectionStageLabel[connectionStage]}
            </Tag>
            <Tag
              color={remoteAudioReady ? 'success' : 'processing'}
              icon={<SoundOutlined />}
            >
              {remoteAudioReady ? '客户音频已接入' : '等待客户音频'}
            </Tag>
            <Tag
              color={
                networkQuality === 'poor' || networkQuality === 'lost'
                  ? 'warning'
                  : 'blue'
              }
              icon={<WifiOutlined />}
            >
              网络{qualityLabel[networkQuality]}
            </Tag>
          </Flex>
        </div>
      </div>

      <div className="agent-current-call-controls">
        <Button
          icon={microphoneEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
          disabled={!active}
          onClick={() => void onToggleMicrophone()}
        >
          {microphoneEnabled ? '静音' : '取消静音'}
        </Button>
        <Select
          aria-label="选择麦克风"
          className="agent-current-call-device"
          placeholder="切换麦克风"
          disabled={!active || devices.length === 0}
          options={devices}
          onChange={(deviceId) => void onSwitchAudioInput(deviceId)}
        />
        <Button
          danger
          disabled={!active}
          onClick={() => setEndConfirmOpen(true)}
        >
          结束客户通话
        </Button>
      </div>

      <Modal
        title="确认结束客户通话"
        open={endConfirmOpen}
        okText="确认结束"
        okType="danger"
        cancelText="继续通话"
        confirmLoading={ending}
        mask={{ enabled: true, closable: false }}
        onCancel={() => setEndConfirmOpen(false)}
        onOk={async () => {
          setEnding(true);
          try {
            await onEndCall();
            setEndConfirmOpen(false);
          } finally {
            setEnding(false);
          }
        }}
      >
        {endConfirmDescription}
      </Modal>
    </div>
  );
};

export default CurrentCallPanel;
