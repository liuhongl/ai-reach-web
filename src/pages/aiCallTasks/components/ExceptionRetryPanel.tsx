import {
  DownloadOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Drawer,
  Input,
  InputNumber,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ExceptionCategory,
  ExceptionDisplayStatus,
  ExceptionSummary,
  ExceptionSummaryCard,
  ExceptionTarget,
} from '../domain';
import {
  downloadExceptionTargets,
  getExceptionSummary,
  listExceptionTargets,
  startExceptionBatch,
  updateExceptionPolicy,
} from '../service';
import './ExceptionRetryPanel.css';

const CATEGORY_META: Record<
  ExceptionCategory,
  { title: string; color: string; description: string }
> = {
  no_answer: {
    title: '无人接听',
    color: '#faad14',
    description: '包含无人接听和忙线号码',
  },
  rejected: {
    title: '电话拒接',
    color: '#ff4d4f',
    description: '客户明确拒接的号码',
  },
  early_hangup: {
    title: '主动挂断（≤5秒）',
    color: '#722ed1',
    description: '已确认由客户侧在接通 5 秒内主动挂断',
  },
  invalid_number: {
    title: '空号停机',
    color: '#98a2b3',
    description: '号码无效或停机，仅支持查看和下载',
  },
};

const STATUS_META: Record<
  ExceptionDisplayStatus,
  { text: string; color: string }
> = {
  PENDING: { text: '待重呼', color: 'gold' },
  WAITING: { text: '等待执行', color: 'blue' },
  CALLING: { text: '重呼中', color: 'processing' },
  CONNECTED: { text: '已接通', color: 'success' },
  MAXED: { text: '已达上限', color: 'default' },
  UNAVAILABLE: { text: '不可重呼', color: 'error' },
  STOPPED: { text: '已停止', color: 'default' },
};

const RESULT_LABELS: Record<string, string> = {
  no_answer: '无人接听',
  busy: '忙线',
  rejected: '电话拒接',
  early_hangup: '主动挂断（≤5秒）',
  invalid_number: '空号停机',
  connected: '已接通',
  call_failed: '呼叫失败',
};

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `exception-batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请稍后重试';

type PolicyDraft = { intervalDays: number; maxRetryCount: number };

const ExceptionRetryPanel = () => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [summary, setSummary] = useState<ExceptionSummary>();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [drafts, setDrafts] = useState<
    Partial<Record<ExceptionCategory, PolicyDraft>>
  >({});
  const [savingCategory, setSavingCategory] = useState<ExceptionCategory>();
  const [startingCategory, setStartingCategory] = useState<ExceptionCategory>();
  const [detailCategory, setDetailCategory] = useState<ExceptionCategory>();
  const [detailRows, setDetailRows] = useState<ExceptionTarget[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailKeyword, setDetailKeyword] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const result = await getExceptionSummary();
      setSummary(result);
      setDrafts((current) => {
        const next = { ...current };
        result.cards.forEach((card) => {
          if (!next[card.category] && card.policy) {
            next[card.category] = {
              intervalDays: card.policy.intervalDays,
              maxRetryCount: card.policy.maxRetryCount,
            };
          }
        });
        return next;
      });
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSummaryLoading(false);
    }
  }, [messageApi]);

  const loadDetails = useCallback(async () => {
    if (!detailCategory) return;
    setDetailLoading(true);
    try {
      const result = await listExceptionTargets({
        category: detailCategory,
        pageNum: detailPage,
        pageSize: 20,
        keyword: detailKeyword.trim() || undefined,
      });
      setDetailRows(result.rows);
      setDetailTotal(result.total);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }, [detailCategory, detailKeyword, detailPage, messageApi]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!summary?.cards.some((card) => card.activeBatch)) return undefined;
    const timer = window.setInterval(() => void loadSummary(), 10_000);
    return () => window.clearInterval(timer);
  }, [loadSummary, summary]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const savePolicy = async (card: ExceptionSummaryCard) => {
    if (!card.policy) return;
    const draft = drafts[card.category];
    if (
      !draft ||
      (draft.intervalDays === card.policy.intervalDays &&
        draft.maxRetryCount === card.policy.maxRetryCount)
    ) {
      return;
    }
    setSavingCategory(card.category);
    try {
      await updateExceptionPolicy(card.category, draft);
      messageApi.success('规则已保存，仅影响以后启动的新批次');
      await loadSummary();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSavingCategory(undefined);
    }
  };

  const confirmStart = (card: ExceptionSummaryCard) => {
    const draft = drafts[card.category];
    if (!draft) return;
    modalApi.confirm({
      title: `重新外呼${CATEGORY_META[card.category].title}号码`,
      content: `将本次待重呼的 ${card.pendingCount} 个号码加入一批，间隔 ${draft.intervalDays} 天，最多补呼 ${draft.maxRetryCount} 次。`,
      okText: '确认重新外呼',
      cancelText: '取消',
      onOk: async () => {
        setStartingCategory(card.category);
        try {
          if (
            draft.intervalDays !== card.policy?.intervalDays ||
            draft.maxRetryCount !== card.policy?.maxRetryCount
          ) {
            await updateExceptionPolicy(card.category, draft);
          }
          await startExceptionBatch(card.category, createIdempotencyKey());
          messageApi.success('重新外呼批次已启动');
          await loadSummary();
          if (detailCategory === card.category) await loadDetails();
        } catch (error) {
          messageApi.error(getErrorMessage(error));
          throw error;
        } finally {
          setStartingCategory(undefined);
        }
      },
    });
  };

  const openDetails = (category: ExceptionCategory) => {
    setDetailCategory(category);
    setDetailPage(1);
    setDetailKeyword('');
  };

  const columns = useMemo<ColumnsType<ExceptionTarget>>(
    () => [
      { title: '客户名称', dataIndex: 'customerName', width: 120, render: (value) => value || '—' },
      { title: '号码', dataIndex: 'phoneNumber', width: 130, render: (value) => value || '—' },
      { title: '所属任务', dataIndex: 'taskName', width: 180 },
      {
        title: '最终异常结果',
        dataIndex: 'sourceResult',
        width: 130,
        render: (value) => RESULT_LABELS[value] || value || '—',
      },
      { title: '原任务外呼次数', dataIndex: 'originalAttemptCount', width: 130 },
      {
        title: '异常重呼进度',
        key: 'retryProgress',
        width: 120,
        render: (_, row) => `${row.retryCount}/${row.maxRetryCount}`,
      },
      {
        title: '处理状态',
        dataIndex: 'status',
        width: 110,
        render: (value: ExceptionDisplayStatus) => (
          <Tag color={STATUS_META[value].color}>{STATUS_META[value].text}</Tag>
        ),
      },
      { title: '下次执行时间', dataIndex: 'nextAttemptAt', width: 180, render: (value) => value || '—' },
      { title: '最后外呼时间', dataIndex: 'lastAttemptAt', width: 180, render: (value) => value || '—' },
      {
        title: '最后结果',
        dataIndex: 'lastResult',
        width: 120,
        render: (value) => RESULT_LABELS[value] || value || '—',
      },
      {
        title: '通话记录',
        dataIndex: 'callId',
        fixed: 'right',
        width: 100,
        render: (callId) =>
          callId ? (
            <Button
              type="link"
              onClick={() =>
                history.push(`/ai-call/records?callId=${encodeURIComponent(callId)}`)
              }
            >
              查看
            </Button>
          ) : (
            '—'
          ),
      },
    ],
    [],
  );

  return (
    <Card className="exception-retry-panel" loading={summaryLoading}>
      {messageContextHolder}
      {modalContextHolder}
      <Space align="start" size={10}>
        <PhoneOutlined className="text-purple-600" />
        <div>
          <Typography.Title level={4} className="!mb-1 !mt-0">
            异常呼叫处理与再次外呼策略
          </Typography.Title>
          <Typography.Text type="secondary">
            对已完成原呼叫规则的最终异常号码设置补呼间隔和次数，并由用户人工启动本批重新外呼。
          </Typography.Text>
        </div>
      </Space>

      <div className="exception-retry-grid">
        {(summary?.cards || []).map((card) => {
          const meta = CATEGORY_META[card.category];
          const draft = drafts[card.category];
          const running = Boolean(card.activeBatch);
          const retryable = Boolean(card.policy);
          return (
            <Card
              className="exception-retry-card"
              key={card.category}
              size="small"
              title={
                <span className="exception-retry-card__title">
                  <span
                    className="exception-retry-card__dot"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.title}
                </span>
              }
              extra={
                <Button type="link" onClick={() => openDetails(card.category)}>
                  查看明细
                </Button>
              }
            >
              <div className="exception-retry-card__summary">
                <div>{meta.description}</div>
                {retryable ? (
                  <div>
                    共 {card.totalCount} 个｜待重呼 {card.pendingCount}｜已达上限{' '}
                    {card.maxedOutCount}
                    {card.activeBatch
                      ? `｜重呼进行中 ${card.activeBatch.completedCount}/${card.activeBatch.targetCount}`
                      : ''}
                  </div>
                ) : (
                  <div>共 {card.totalCount} 个｜不可重呼 {card.totalCount}</div>
                )}
              </div>

              <div className="exception-retry-card__policy">
                {retryable && draft ? (
                  <>
                    <label
                      className="exception-retry-card__policy-row"
                      htmlFor={`exception-interval-${card.category}`}
                    >
                      <span>外呼间隔</span>
                      <span className="exception-retry-card__number-field">
                        <InputNumber
                          disabled={savingCategory === card.category}
                          id={`exception-interval-${card.category}`}
                          max={365}
                          min={1}
                          precision={0}
                          value={draft.intervalDays}
                          onBlur={() => void savePolicy(card)}
                          onChange={(value) =>
                            setDrafts((current) => ({
                              ...current,
                              [card.category]: {
                                ...draft,
                                intervalDays: value || 1,
                              },
                            }))
                          }
                        />
                        <span>天</span>
                      </span>
                    </label>
                    <label
                      className="exception-retry-card__policy-row"
                      htmlFor={`exception-limit-${card.category}`}
                    >
                      <span>最多补呼</span>
                      <span className="exception-retry-card__number-field">
                        <InputNumber
                          disabled={savingCategory === card.category}
                          id={`exception-limit-${card.category}`}
                          max={5}
                          min={1}
                          precision={0}
                          value={draft.maxRetryCount}
                          onBlur={() => void savePolicy(card)}
                          onChange={(value) =>
                            setDrafts((current) => ({
                              ...current,
                              [card.category]: {
                                ...draft,
                                maxRetryCount: value || 1,
                              },
                            }))
                          }
                        />
                        <span>次</span>
                      </span>
                    </label>
                  </>
                ) : (
                  <Typography.Text type="secondary">
                    失效或停机号码无法被重新外呼。
                  </Typography.Text>
                )}
              </div>

              <div className="exception-retry-card__actions">
                <Button
                  block
                  disabled={!card.canStart}
                  icon={<ReloadOutlined />}
                  loading={startingCategory === card.category}
                  type="primary"
                  onClick={() => confirmStart(card)}
                >
                  {!retryable
                    ? '无法重新外呼'
                    : running
                      ? '本批重新外呼中'
                      : '一键重新外呼'}
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    void downloadExceptionTargets(card.category).catch((error) =>
                      messageApi.error(getErrorMessage(error)),
                    )
                  }
                >
                  下载数据
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Drawer
        destroyOnHidden
        open={detailCategory !== undefined}
        size="large"
        title={
          detailCategory
            ? `${CATEGORY_META[detailCategory].title}异常号码明细`
            : '异常号码明细'
        }
        onClose={() => setDetailCategory(undefined)}
      >
        <Input.Search
          allowClear
          className="mb-4"
          placeholder="搜索客户名称或任务名称"
          style={{ width: 260 }}
          onSearch={(value) => {
            setDetailKeyword(value);
            setDetailPage(1);
          }}
        />
        <Table<ExceptionTarget>
          columns={columns}
          dataSource={detailRows}
          loading={detailLoading}
          pagination={{
            current: detailPage,
            pageSize: 20,
            total: detailTotal,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个号码`,
            onChange: setDetailPage,
          }}
          rowKey="targetId"
          scroll={{ x: 1500 }}
        />
      </Drawer>
    </Card>
  );
};

export default ExceptionRetryPanel;
