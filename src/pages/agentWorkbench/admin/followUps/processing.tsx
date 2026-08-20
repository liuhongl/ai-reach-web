import { Modal, message } from 'antd';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import type {
  FollowUpCallbackCredentialDto,
  FollowUpTaskDto,
} from '@/services/ruoyi/agent-console';
import { getAgentFollowUp } from '@/services/ruoyi/agent-console';
import CurrentCallPanel from '../../components/CurrentCallPanel';
import FollowUpPanel from '../../components/FollowUpPanel';
import { useAgentPresence } from '../../hooks/useAgentPresence';
import { useFollowUpCallback } from '../../hooks/useFollowUpCallback';

const FollowUpProcessingPage = () => {
  const agent = useAgentPresence({ suppressExistingSessionMessage: true });
  const [messageApi, messageContextHolder] = message.useMessage();
  const [callback, setCallback] = useState<FollowUpCallbackCredentialDto>();
  const [callbackTask, setCallbackTask] = useState<FollowUpTaskDto>();
  const [handlingTaskToOpen, setHandlingTaskToOpen] = useState<{
    task: FollowUpTaskDto;
    callId: string;
  }>();
  const settlingCallbackRef = useRef<string | undefined>(undefined);
  const callbackCall = useFollowUpCallback({
    credential: callback,
    followUpId: callbackTask?.id,
    consoleSessionId: agent.consoleSessionId,
    refresh: agent.bootstrap,
  });
  const prepareCallback = useCallback(async () => {
    return agent.status === 'available' || agent.goOnline();
  }, [agent.goOnline, agent.status]);
  const settleCallback = useCallback(async () => {
    const task = callbackTask;
    const callId = callback?.call_id;
    if (!task || !callId || settlingCallbackRef.current === callId) return;
    settlingCallbackRef.current = callId;
    for (let index = 0; index < 5; index += 1) {
      try {
        const response = await getAgentFollowUp(task.id);
        const detail =
          response &&
          typeof response === 'object' &&
          Reflect.get(response, 'data')
            ? Reflect.get(response, 'data')
            : response;
        if (
          detail &&
          typeof detail === 'object' &&
          Reflect.get(detail, 'pending_handling_call_id') === callId
        ) {
          setCallback(undefined);
          setCallbackTask(undefined);
          setHandlingTaskToOpen({ task: detail as FollowUpTaskDto, callId });
          messageApi.success(
            callbackCall.errorMessage
              ? '对方已挂断，请提交处理结果'
              : '通话已结束，请提交处理结果',
          );
          return;
        }
      } catch {
        // 等待回拨终态与联系记录在同一读模型中可见。
      }
      if (index < 4) await new Promise((resolve) => setTimeout(resolve, 400));
    }
    messageApi.warning('通话已挂断，回拨结果仍在同步，请稍后刷新我的任务');
  }, [callback?.call_id, callbackCall.errorMessage, callbackTask, messageApi]);
  const endCallbackCall = useCallback(async () => {
    await callbackCall.endCall();
  }, [callbackCall.endCall]);
  const clearHandlingTask = useCallback(
    () => setHandlingTaskToOpen(undefined),
    [],
  );

  useEffect(() => {
    if (agent.errorMessage) messageApi.error(agent.errorMessage);
  }, [agent.errorMessage, messageApi]);

  useEffect(() => {
    if (callbackCall.phase === 'ended') void settleCallback();
  }, [callbackCall.phase, settleCallback]);

  return (
    <ListPage className="agent-admin-page" title="回访任务">
      {messageContextHolder}
      <Modal
        title="回拨通话"
        open={Boolean(callback)}
        width={760}
        footer={null}
        closable={false}
        maskClosable={false}
      >
        <CurrentCallPanel
          {...callbackCall}
          endConfirmDescription="结束后客户将退出本次回拨，并进入处理结果提交。"
          onToggleMicrophone={callbackCall.toggleMicrophone}
          onSwitchAudioInput={callbackCall.switchAudioInput}
          onEndCall={endCallbackCall}
        />
      </Modal>
      <FollowUpPanel
        agentStatus={agent.status}
        callbackEnabled
        consoleSessionId={agent.consoleSessionId}
        handlingTaskToOpen={handlingTaskToOpen}
        onHandlingTaskOpened={clearHandlingTask}
        onPrepareCallback={prepareCallback}
        onCallAccepted={(nextCallback, task: FollowUpTaskDto) => {
          setCallbackTask(task);
          setCallback(nextCallback);
        }}
      />
    </ListPage>
  );
};

export default FollowUpProcessingPage;
