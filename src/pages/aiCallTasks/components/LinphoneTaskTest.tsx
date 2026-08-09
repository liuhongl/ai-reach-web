import { PhoneOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Radio,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AiCallTask,
  AiCallTaskTarget,
  AiCallTaskTestCapability,
  AiCallTaskTestStatus,
  LinphoneTestPhase,
  LinphoneTestScenario,
} from '../domain';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import {
  endAiCallTaskActiveCall,
  getAiCallTaskTestCapability,
  getAiCallTaskTestStatus,
  listAiCallTaskTargets,
  runAiCallTaskTest,
} from '../service';

const { Text } = Typography;

type LinphoneTaskTestProps = {
  task: AiCallTask;
  onTaskChanged: () => Promise<void> | void;
  children?: (content: {
    trigger: React.ReactNode;
    activeStatus: React.ReactNode;
  }) => React.ReactNode;
};

const maskPhone = (value: string) =>
  value.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '外呼对象加载失败';

const phaseText: Record<LinphoneTestPhase, string> = {
  dialing: '正在拨号',
  ai_call: 'AI 通话中',
  waiting_handoff: '等待坐席接单',
  human_call: '人工通话中',
  completed: '通话已完成',
  failed: '测试失败',
};

const isTerminalStatus = (status?: AiCallTaskTestStatus) =>
  status?.phase === 'completed' || status?.phase === 'failed';

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

const createCommandKey = (taskId: string) => {
  const suffix =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `linphone-test-${taskId}-${suffix}`;
};

const createEndCommandKey = (callId: string) => {
  const suffix =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `linphone-end-${callId}-${suffix}`;
};

const LinphoneTaskTest = ({
  task,
  onTaskChanged,
  children,
}: LinphoneTaskTestProps) => {
  const [capability, setCapability] = useState<AiCallTaskTestCapability | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [scenario, setScenario] = useState<LinphoneTestScenario>('ai_only');
  const [target, setTarget] = useState<AiCallTaskTarget>();
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState<string>();
  const [activeCallId, setActiveCallId] = useState<string>();
  const [testStatus, setTestStatus] = useState<AiCallTaskTestStatus>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();
  const [endError, setEndError] = useState<string>();
  const taskIdRef = useRef(task.taskId);
  const startingRef = useRef(false);
  const commandKeyRef = useRef<string | undefined>(undefined);
  const processedTerminalAttemptRef = useRef<string | undefined>(undefined);

  taskIdRef.current = task.taskId;
  const hasActiveTest = Boolean(
    activeCallId || (testStatus && !isTerminalStatus(testStatus)),
  );

  const loadCapability = useCallback(async () => {
    const requestedTaskId = task.taskId;
    try {
      const result = await getAiCallTaskTestCapability(requestedTaskId);
      if (taskIdRef.current !== requestedTaskId) return;
      setCapability(result);
      setActiveCallId(result.activeCallId || undefined);
    } catch {
      if (taskIdRef.current !== requestedTaskId) return;
      setCapability(null);
      setActiveCallId(undefined);
    }
  }, [task.taskId]);

  const loadTestStatus = useCallback(async () => {
    const requestedTaskId = task.taskId;
    const result = await getAiCallTaskTestStatus(requestedTaskId);
    if (taskIdRef.current !== requestedTaskId) return;
    setTestStatus(result);
    setActiveCallId(isTerminalStatus(result) ? undefined : result.callId);
  }, [task.taskId]);

  useEffect(() => {
    setCapability(null);
    setActiveCallId(undefined);
    setTestStatus(undefined);
    setEndError(undefined);
    processedTerminalAttemptRef.current = undefined;
    commandKeyRef.current = undefined;
    void loadCapability();
  }, [loadCapability]);

  useVisiblePolling({
    enabled: Boolean(activeCallId && !isTerminalStatus(testStatus)),
    intervalMs: 1_000,
    onTick: loadTestStatus,
  });

  useEffect(() => {
    if (
      !testStatus ||
      !isTerminalStatus(testStatus) ||
      processedTerminalAttemptRef.current === testStatus.attemptId
    ) {
      return;
    }
    processedTerminalAttemptRef.current = testStatus.attemptId;
    void Promise.all([onTaskChanged(), loadCapability()]);
  }, [loadCapability, onTaskChanged, testStatus]);

  const loadTarget = async () => {
    if (target || targetLoading) return;
    setTargetLoading(true);
    setTargetError(undefined);
    try {
      const response = await listAiCallTaskTargets(task.taskId, {
        pageNum: 1,
        pageSize: 1,
      });
      setTarget(response.rows[0]);
    } catch (error) {
      setTargetError(getErrorMessage(error));
    } finally {
      setTargetLoading(false);
    }
  };

  const openModal = () => {
    if (hasActiveTest || startingRef.current) return;
    setScenario('ai_only');
    setStartError(undefined);
    commandKeyRef.current = undefined;
    setModalOpen(true);
    void loadTarget();
  };

  const closeModal = () => {
    if (startingRef.current) return;
    setModalOpen(false);
    setStartError(undefined);
    commandKeyRef.current = undefined;
  };

  const startTest = async () => {
    if (startingRef.current || hasActiveTest || !target) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(undefined);
    commandKeyRef.current ||= createCommandKey(task.taskId);
    try {
      const accepted = await runAiCallTaskTest(
        task.taskId,
        scenario,
        commandKeyRef.current,
      );
      setModalOpen(false);
      setActiveCallId(accepted.callId);
      await loadTestStatus();
    } catch (error) {
      setStartError(getErrorMessage(error));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const confirmEndActiveCall = () => {
    if (!testStatus?.canEndActiveCall) return;
    setEndError(undefined);
    Modal.confirm({
      title: '结束当前通话',
      content:
        '仅结束当前通话，不会停止整个外呼任务。通话结束后将按真实结果更新任务。',
      okText: '确认结束通话',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await endAiCallTaskActiveCall(
            task.taskId,
            createEndCommandKey(testStatus.callId),
          );
          await loadTestStatus();
        } catch (error) {
          setEndError(getErrorMessage(error));
        }
      },
    });
  };

  const trigger = capability?.enabled ? (
    <Tooltip
      title={
        hasActiveTest
          ? '当前任务已有测试通话'
          : capability.eligible
            ? undefined
            : capability.reasons.join('；')
      }
    >
      <span>
        <Button
          disabled={!capability.eligible || hasActiveTest || starting}
          icon={<PhoneOutlined aria-hidden />}
          onClick={openModal}
        >
          测试拨打
        </Button>
      </span>
    </Tooltip>
  ) : null;

  const activeStatus =
    testStatus && !isTerminalStatus(testStatus) ? (
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Alert
          action={
            testStatus.canEndActiveCall ? (
              <Button danger size="small" onClick={confirmEndActiveCall}>
                结束当前通话
              </Button>
            ) : null
          }
          showIcon
          title={
            <Space size={8} wrap>
              <Text strong>测试拨打中</Text>
              <Text>{phaseText[testStatus.phase]}</Text>
              <Text type="secondary">
                {formatDuration(testStatus.elapsedSeconds)}
              </Text>
            </Space>
          }
          type="info"
        />
        {testStatus.errorMessage ? (
          <Alert showIcon title={testStatus.errorMessage} type="error" />
        ) : null}
        {endError ? <Alert showIcon title={endError} type="error" /> : null}
      </Space>
    ) : null;

  return (
    <>
      {children ? (
        children({ trigger, activeStatus })
      ) : capability?.enabled ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {trigger}
          {activeStatus}
        </Space>
      ) : null}

      <Modal
        cancelText="取消"
        okButtonProps={{
          disabled: !target || targetLoading || Boolean(targetError),
        }}
        okText="确认拨打"
        open={modalOpen}
        confirmLoading={starting}
        title="确认测试拨打"
        width={680}
        onCancel={closeModal}
        onOk={() => void startTest()}
      >
        <Spin spinning={targetLoading}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {targetError ? (
              <Alert showIcon title={targetError} type="error" />
            ) : null}
            {startError ? (
              <Alert showIcon title={startError} type="error" />
            ) : null}
            <Descriptions
              bordered
              column={{ xs: 1, sm: 2 }}
              items={[
                {
                  key: 'customerName',
                  label: '客户名称',
                  children: target?.customerName || '—',
                },
                {
                  key: 'phoneNumber',
                  label: '手机号',
                  children: target?.phoneNumber
                    ? maskPhone(target.phoneNumber)
                    : '—',
                },
                {
                  key: 'prompt',
                  label: '提示词',
                  children: `${task.promptName} / ${task.sceneCode}`,
                },
                {
                  key: 'voice',
                  label: '音色',
                  children: task.voiceName || '—',
                },
                {
                  key: 'rule',
                  label: '呼叫规则',
                  children: task.ruleName,
                },
                {
                  key: 'ruleSummary',
                  label: '规则摘要',
                  children: task.ruleSummary,
                },
              ]}
            />

            <Radio.Group
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              <Space orientation="vertical">
                <Radio value="ai_only">AI 完整通话</Radio>
                <Radio
                  disabled={capability?.availableAgentCount === 0}
                  value="handoff"
                >
                  AI 转人工通话
                </Radio>
              </Space>
            </Radio.Group>

            {capability?.availableAgentCount === 0 ? (
              <Text type="warning">暂无可用坐席，请先到坐席工作台上线</Text>
            ) : null}

            {scenario === 'handoff' ? (
              <ol className="m-0 pl-5">
                <li>保持坐席工作台在线</li>
                <li>接听 Linphone</li>
                <li>向 AI 明确要求转人工</li>
                <li>在坐席工作台接单</li>
                <li>完成人工通话并结束</li>
              </ol>
            ) : null}
          </Space>
        </Spin>
      </Modal>
    </>
  );
};

export default LinphoneTaskTest;
