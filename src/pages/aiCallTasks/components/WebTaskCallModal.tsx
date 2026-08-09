import {
  AudioMutedOutlined,
  DisconnectOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { Button, Modal, Space, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import {
  type AiCallLabRoomConnection,
  connectAiCallLabRoom,
} from '@/pages/aiCallLab/customer/livekitClient';
import {
  getAiCallRuntimeBrowserToken,
  reportAiCallTaskBrowserEvent,
} from '../service';

const { Text } = Typography;

type WebTaskCallModalProps = {
  callId: string;
  open: boolean;
  onClosed: (callId: string) => void;
};

const WebTaskCallModal = ({
  callId,
  open,
  onClosed,
}: WebTaskCallModalProps) => {
  const connectionRef = useRef<AiCallLabRoomConnection | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);

  const closeCall = async (eventType: string) => {
    setConnecting(true);
    try {
      await connectionRef.current?.disconnect();
      await reportAiCallTaskBrowserEvent(callId, eventType);
    } finally {
      connectionRef.current = undefined;
      setConnected(false);
      setMicrophoneEnabled(true);
      setConnecting(false);
      onClosed(callId);
    }
  };

  const acceptCall = async () => {
    setConnecting(true);
    try {
      const token = await getAiCallRuntimeBrowserToken(callId);
      connectionRef.current = await connectAiCallLabRoom(token, () => {
        connectionRef.current = undefined;
        setConnected(false);
        setMicrophoneEnabled(true);
        setConnecting(false);
        onClosed(callId);
      });
      await reportAiCallTaskBrowserEvent(callId, 'browser_ready');
      setConnected(true);
    } catch {
      await closeCall('browser_connection_failed');
    } finally {
      setConnecting(false);
    }
  };

  const toggleMicrophone = async () => {
    const next = !microphoneEnabled;
    await connectionRef.current?.setMicrophoneEnabled(next);
    setMicrophoneEnabled(next);
  };

  return (
    <Modal
      centered
      closable={false}
      footer={null}
      maskClosable={false}
      open={open}
      title={connected ? 'Web 通话中' : 'Web 来电'}
    >
      <Space orientation="vertical" size={16} className="w-full">
        <Text>
          {connected
            ? '已接通 AI 外呼，可继续转人工处理。'
            : 'AI 外呼正在等待接听。'}
        </Text>
        {connected ? (
          <Space>
            <Button
              icon={<AudioMutedOutlined />}
              onClick={() => void toggleMicrophone()}
            >
              {microphoneEnabled ? '静音' : '取消静音'}
            </Button>
            <Button
              danger
              icon={<DisconnectOutlined />}
              loading={connecting}
              onClick={() => void closeCall('browser_disconnect')}
            >
              挂断
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              loading={connecting}
              onClick={() => void closeCall('browser_disconnect')}
            >
              拒绝
            </Button>
            <Button
              icon={<PhoneOutlined />}
              loading={connecting}
              type="primary"
              onClick={() => void acceptCall()}
            >
              接听
            </Button>
          </Space>
        )}
      </Space>
    </Modal>
  );
};

export default WebTaskCallModal;
