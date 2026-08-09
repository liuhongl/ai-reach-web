import { PhoneOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Flex, Spin, Tag, Typography } from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import {
  claimHandoff,
  type HandoffDto,
  type MediaCredentialDto,
} from '@/services/ruoyi/agent-console';
import './WaitingPool.css';

const { Text } = Typography;

export type WaitingPoolProps = {
  handoffs: HandoffDto[];
  loading?: boolean;
  agentStatus: string;
  consoleSessionId: string;
  claim?: (
    handoffId: string,
    input: { consoleSessionId: string; idempotencyKey: string },
  ) => Promise<unknown>;
  onClaimed?: (credential: MediaCredentialDto) => void;
  onRemove?: (handoffId: string) => void;
  now?: number;
};

const sceneLabels: Record<string, string> = {
  intro_contract: '合同审核',
  intro_document: '跨境文书',
  intro_overseas: '海外获客',
  intro_geo: 'GEO',
};

export type HandoffSlaLevel = 'normal' | 'warning' | 'urgent';

export const getHandoffWaitingSeconds = (handoff: HandoffDto, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(handoff.requested_at)) / 1000));

export const getHandoffSlaLevel = (seconds: number): HandoffSlaLevel => {
  if (seconds < 30) return 'normal';
  if (seconds < 45) return 'warning';
  return 'urgent';
};

const unwrapCredential = (response: unknown): MediaCredentialDto => {
  const payload =
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (response as { data?: unknown }).data
      ? (response as { data: unknown }).data
      : response;
  if (payload && typeof payload === 'object' && 'seat_token' in payload) {
    const result = payload as {
      handoff: HandoffDto;
      seat_token: Omit<MediaCredentialDto, 'handoff'>;
    };
    return {
      handoff: result.handoff,
      livekit_url: result.seat_token.livekit_url,
      participant_token: result.seat_token.participant_token,
      participant_identity: result.seat_token.participant_identity,
    };
  }
  return payload as MediaCredentialDto;
};

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined;
  const direct = Reflect.get(error, 'code');
  if (typeof direct === 'string') return direct;
  const response = Reflect.get(error, 'response');
  const data =
    response && typeof response === 'object'
      ? Reflect.get(response, 'data')
      : undefined;
  const nested =
    data && typeof data === 'object'
      ? Reflect.get(data, 'errorCode')
      : undefined;
  return typeof nested === 'string' ? nested : undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '接听失败，请刷新后重试';

const WaitingPool = ({
  handoffs,
  loading = false,
  agentStatus,
  consoleSessionId,
  claim = claimHandoff,
  onClaimed,
  onRemove,
  now = Date.now(),
}: WaitingPoolProps) => {
  const inFlight = useRef(new Set<string>());
  const [claimingId, setClaimingId] = useState<string>();
  const [removedIds, setRemovedIds] = useState(() => new Set<string>());
  const [notice, setNotice] = useState('');
  const visibleHandoffs = useMemo(
    () =>
      handoffs
        .filter((item) => !removedIds.has(item.handoff_id))
        .sort(
          (left, right) =>
            Date.parse(left.requested_at) - Date.parse(right.requested_at),
        ),
    [handoffs, removedIds],
  );
  const longestWaitingSeconds = visibleHandoffs.length
    ? getHandoffWaitingSeconds(visibleHandoffs[0], now)
    : 0;

  const handleClaim = async (handoff: HandoffDto) => {
    const handoffId = handoff.handoff_id;
    if (inFlight.current.has(handoffId) || agentStatus !== 'available') return;
    inFlight.current.add(handoffId);
    setClaimingId(handoffId);
    setNotice('');
    try {
      const response = await claim(handoffId, {
        consoleSessionId,
        idempotencyKey: crypto.randomUUID(),
      });
      onClaimed?.(unwrapCredential(response));
    } catch (error) {
      if (getErrorCode(error) === 'HANDOFF_ALREADY_CLAIMED') {
        setRemovedIds((current) => new Set(current).add(handoffId));
        setNotice('已被其他坐席接听');
        onRemove?.(handoffId);
      } else {
        setNotice(getErrorMessage(error));
      }
    } finally {
      inFlight.current.delete(handoffId);
      setClaimingId(undefined);
    }
  };

  return (
    <div
      className={
        visibleHandoffs.length
          ? 'agent-waiting-pool'
          : 'agent-waiting-pool agent-workbench-empty-state'
      }
    >
      {notice ? (
        <Alert
          className="agent-waiting-pool-notice"
          type="info"
          showIcon
          title={notice}
        />
      ) : null}
      <Spin spinning={loading}>
        {visibleHandoffs.length ? (
          <div className="agent-waiting-pool-list">
            <Flex
              className="agent-waiting-pool-overview"
              justify="space-between"
              align="center"
            >
              <Text type="secondary">按等待时间顺序处理</Text>
              <Text type="secondary">最长等待 {longestWaitingSeconds} 秒</Text>
            </Flex>
            {visibleHandoffs.map((handoff, index) => {
              const waitingSeconds = getHandoffWaitingSeconds(handoff, now);
              const slaLevel = getHandoffSlaLevel(waitingSeconds);
              const isQueueHead = index === 0;
              const canClaim = isQueueHead && agentStatus === 'available';
              const customer = [
                handoff.masked_customer_name,
                handoff.masked_contact,
              ]
                .filter(Boolean)
                .join(' · ');
              const queueState = isQueueHead
                ? agentStatus === 'in_call' || agentStatus === 'reconnecting'
                  ? '通话中，暂不可接管'
                  : agentStatus === 'wrap_up_quick'
                    ? '话后处理中，暂不可接管'
                    : agentStatus === 'available'
                      ? '优先接管'
                      : '当前状态不可接管'
                : '排队中';
              return (
                <article
                  className="agent-waiting-pool-item"
                  data-queue-position={isQueueHead ? 'head' : 'waiting'}
                  key={handoff.handoff_id}
                >
                  <div className="agent-waiting-pool-content">
                    <Flex
                      className="agent-waiting-pool-item-header"
                      justify="space-between"
                      gap="small"
                      align="flex-start"
                    >
                      <div className="agent-waiting-pool-identity">
                        <Flex gap="small" align="center" wrap>
                          <Tag color={isQueueHead ? 'blue' : 'default'}>
                            {sceneLabels[handoff.scene_code] ||
                              handoff.scene_code}
                          </Tag>
                          {isQueueHead ? (
                            <Tag color="processing">队首</Tag>
                          ) : null}
                        </Flex>
                        <Text strong>{customer || '客户信息待加载'}</Text>
                      </div>
                      <div className="agent-waiting-pool-wait">
                        <span
                          className="agent-waiting-pool-timer"
                          data-sla-level={slaLevel}
                        >
                          已等待 {waitingSeconds} 秒
                        </span>
                      </div>
                    </Flex>
                    <Text
                      className="agent-waiting-pool-reason"
                      type="secondary"
                    >
                      {handoff.request_reason ||
                        handoff.handoff_summary ||
                        handoff.request_message ||
                        '等待人工接管'}
                    </Text>
                    {handoff.handoff_summary &&
                    handoff.handoff_summary !== handoff.request_reason ? (
                      <Text className="agent-waiting-pool-summary">
                        {handoff.handoff_summary}
                      </Text>
                    ) : null}
                    <Flex
                      className="agent-waiting-pool-action"
                      justify="space-between"
                      align="center"
                      gap="small"
                    >
                      <Text
                        className="agent-waiting-pool-state"
                        type={canClaim ? undefined : 'secondary'}
                      >
                        {queueState}
                      </Text>
                      {canClaim ? (
                        <Button
                          type="primary"
                          size="small"
                          aria-label={`接管通话 ${customer || handoff.handoff_id}`}
                          icon={<PhoneOutlined />}
                          loading={claimingId === handoff.handoff_id}
                          onClick={() => void handleClaim(handoff)}
                        >
                          接管通话
                        </Button>
                      ) : null}
                    </Flex>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无待接通话"
          />
        )}
      </Spin>
    </div>
  );
};

export default WaitingPool;
