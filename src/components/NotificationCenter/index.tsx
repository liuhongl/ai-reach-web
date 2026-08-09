import {
  BellOutlined,
  CheckCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import {
  App,
  Badge,
  Button,
  Drawer,
  Empty,
  Grid,
  Popover,
  Segmented,
  Skeleton,
  Tooltip,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type RuoyiSseMessage,
  subscribeSseMessage,
} from '@/adapters/ruoyi/sse';
import {
  listMessages,
  type MessageItem,
  readAllMessages,
  readMessage,
} from '@/services/ruoyi/message';
import SafeHtml from '../SafeHtml';
import SiderFooterAction from '../SiderFooterAction';

type NotificationCenterProps = {
  collapsed?: boolean;
  contextKey?: string;
  enabled?: boolean;
  variant?: 'icon' | 'sider';
};

type FilterKey = 'all' | 'unread';

const pageSize = 10;
const notificationSseTypes = new Set([
  'resource.message.changed',
  'sys.message.changed',
  'system.notice.changed',
]);

const isNotificationSseMessage = (message: RuoyiSseMessage) => {
  if (message.type) {
    return notificationSseTypes.has(message.type);
  }

  return typeof message.data === 'string' && message.data.trim().length > 0;
};

const useStyles = createStyles(({ token, css }) => ({
  triggerWrap: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    appearance: none;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${token.colorText};
    font: inherit;
    cursor: pointer;
    transition: color ${token.motionDurationMid};

    &:hover {
      color: ${token.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: 2px;
      border-radius: ${token.borderRadius}px;
    }
  `,
  triggerIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    font-size: 15px;
    line-height: 1;
  `,
  panel: css`
    width: 380px;
    max-width: calc(100vw - 32px);
    background: ${token.colorBgElevated};
  `,
  drawerPanel: css`
    width: 100%;
    max-width: none;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  title: css`
    color: ${token.colorText};
    font-weight: 600;
    font-size: 15px;
    line-height: 24px;
  `,
  headerActions: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
  filters: css`
    padding: 12px 16px 8px;
  `,
  listBody: css`
    max-height: 420px;
    overflow-y: auto;
  `,
  drawerListBody: css`
    max-height: calc(100vh - 186px);
  `,
  loading: css`
    padding: 12px 16px 20px;
  `,
  empty: css`
    padding: 44px 16px;
  `,
  item: css`
    display: block;
    width: 100%;
    padding: 12px 16px;
    color: ${token.colorText};
    text-align: left;
    background: ${token.colorBgElevated};
    border-bottom: 1px solid ${token.colorBorderSecondary};
    cursor: pointer;
    transition:
      background ${token.motionDurationMid},
      color ${token.motionDurationMid};

    &:hover {
      background: ${token.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `,
  unreadItem: css`
    background: ${token.colorPrimaryBg};
  `,
  itemMeta: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  `,
  itemState: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  dot: css`
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: ${token.colorPrimary};
  `,
  dotPlaceholder: css`
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
  `,
  itemTime: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
    white-space: nowrap;
  `,
  content: css`
    color: ${token.colorText};
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;

    p,
    div,
    ul,
    ol,
    pre {
      margin-block: 0;
    }

    a {
      color: ${token.colorPrimary};
    }
  `,
  footer: css`
    padding: 10px 16px 14px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  allLoaded: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
    text-align: center;
  `,
}));

const isUnread = (message: MessageItem) =>
  String(message.readStatus ?? '') === '0';

const toCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const formatMessageTime = (value?: string) => {
  if (!value) return '-';

  const time = dayjs(value);
  if (!time.isValid()) return value;

  const now = dayjs();
  if (now.diff(time, 'hour') < 24) {
    return time.fromNow();
  }

  if (now.isSame(time, 'year')) {
    return time.format('MM-DD HH:mm');
  }

  return time.format('YYYY-MM-DD HH:mm');
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  collapsed = false,
  contextKey,
  enabled = true,
  variant = 'icon',
}) => {
  const { styles } = useStyles();
  const { message: messageApi } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const mountedRef = useRef(false);
  const openRef = useRef(false);
  const listRequestSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const loadUnreadCount = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await listMessages(
        {
          pageNum: 1,
          pageSize: 1,
          readStatus: '0',
        },
        { skipErrorHandler: true },
      );
      if (!mountedRef.current) return;
      setUnreadCount(toCount(response.total));
    } catch (error) {
      console.warn('[NotificationCenter] unread count failed:', error);
    }
  }, [enabled]);

  const loadMessages = useCallback(
    async ({
      append = false,
      filter = activeFilter,
      page = 1,
      silent = false,
    }: {
      append?: boolean;
      filter?: FilterKey;
      page?: number;
      silent?: boolean;
    } = {}) => {
      if (!enabled) return;

      const requestSeq = ++listRequestSeqRef.current;
      if (append) {
        setLoadingMore(true);
      } else if (!silent) {
        setLoading(true);
      }

      try {
        const response = await listMessages(
          {
            pageNum: page,
            pageSize,
            readStatus: filter === 'unread' ? '0' : undefined,
          },
          { skipErrorHandler: true },
        );
        if (!mountedRef.current || requestSeq !== listRequestSeqRef.current) {
          return;
        }

        const rows = response.rows || [];
        setMessages((current) => (append ? [...current, ...rows] : rows));
        setTotal(toCount(response.total));
        setPageNum(page);
      } catch (error) {
        console.warn('[NotificationCenter] message list failed:', error);
        if (!silent && mountedRef.current) {
          messageApi.warning('通知加载失败');
        }
      } finally {
        if (mountedRef.current && requestSeq === listRequestSeqRef.current) {
          if (append) {
            setLoadingMore(false);
          } else if (!silent) {
            setLoading(false);
          }
        }
      }
    },
    [activeFilter, enabled, messageApi],
  );

  useEffect(() => {
    setOpen(false);
    setActiveFilter('all');
    setMessages([]);
    setTotal(0);
    setPageNum(1);
    setUnreadCount(0);

    if (enabled) {
      void loadUnreadCount();
    }
  }, [contextKey, enabled, loadUnreadCount]);

  useEffect(() => {
    if (!enabled) return undefined;

    return subscribeSseMessage((sseMessage) => {
      if (!isNotificationSseMessage(sseMessage)) return;

      void loadUnreadCount();
      if (openRef.current) {
        void loadMessages({ page: 1, silent: true });
      }
    });
  }, [enabled, loadMessages, loadUnreadCount]);

  const openPanel = useCallback(() => {
    if (!enabled) return;
    setOpen(true);
    void loadUnreadCount();
    void loadMessages({ page: 1 });
  }, [enabled, loadMessages, loadUnreadCount]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openPanel();
      return;
    }
    setOpen(false);
  };

  const refreshOpenList = useCallback(() => {
    if (openRef.current) {
      void loadMessages({ page: 1, silent: true });
    }
  }, [loadMessages]);

  const markMessageRead = useCallback(
    async (record: MessageItem) => {
      if (!record.messageId || !isUnread(record)) return;

      const messageId = record.messageId;
      setUnreadCount((current) => Math.max(0, current - 1));
      setMessages((current) =>
        activeFilter === 'unread'
          ? current.filter(
              (item) => String(item.messageId) !== String(messageId),
            )
          : current.map((item) =>
              String(item.messageId) === String(messageId)
                ? {
                    ...item,
                    readStatus: '1',
                    readTime: new Date().toISOString(),
                  }
                : item,
            ),
      );
      if (activeFilter === 'unread') {
        setTotal((current) => Math.max(0, current - 1));
      }

      try {
        await readMessage(messageId, { skipErrorHandler: true });
      } catch (error) {
        console.warn('[NotificationCenter] mark read failed:', error);
        messageApi.warning('标记已读失败');
        void loadUnreadCount();
        refreshOpenList();
      }
    },
    [activeFilter, loadUnreadCount, messageApi, refreshOpenList],
  );

  const handleReadAll = async () => {
    if (unreadCount <= 0 || markingAll) return;

    setMarkingAll(true);
    setUnreadCount(0);
    setMessages((current) =>
      activeFilter === 'unread'
        ? []
        : current.map((item) =>
            isUnread(item)
              ? {
                  ...item,
                  readStatus: '1',
                  readTime: new Date().toISOString(),
                }
              : item,
          ),
    );
    if (activeFilter === 'unread') {
      setTotal(0);
    }

    try {
      await readAllMessages({ skipErrorHandler: true });
      void loadUnreadCount();
    } catch (error) {
      console.warn('[NotificationCenter] mark all read failed:', error);
      messageApi.warning('全部已读失败');
      void loadUnreadCount();
      refreshOpenList();
    } finally {
      if (mountedRef.current) {
        setMarkingAll(false);
      }
    }
  };

  const handleFilterChange = (value: string | number) => {
    const nextFilter = value === 'unread' ? 'unread' : 'all';
    setActiveFilter(nextFilter);
    setMessages([]);
    setTotal(0);
    setPageNum(1);

    if (openRef.current) {
      void loadMessages({ filter: nextFilter, page: 1 });
    }
  };

  const hasMore = messages.length < total;
  const emptyText = activeFilter === 'unread' ? '暂无未读通知' : '暂无通知';

  const renderTrigger = (onClick?: () => void) => {
    if (variant === 'sider') {
      return (
        <SiderFooterAction
          aria-label="通知中心"
          badgeCount={unreadCount}
          badgeVariant="dot"
          collapsed={collapsed}
          icon={<BellOutlined />}
          label="通知中心"
          onClick={onClick}
        />
      );
    }

    return (
      <button
        aria-label="通知中心"
        className={styles.triggerWrap}
        type="button"
        onClick={onClick}
      >
        <Badge count={unreadCount} overflowCount={99} size="small">
          <span className={styles.triggerIcon}>
            <BellOutlined />
          </span>
        </Badge>
      </button>
    );
  };

  const renderList = (drawerMode = false) => {
    if (loading && messages.length === 0) {
      return (
        <div className={styles.loading}>
          <Skeleton active paragraph={{ rows: 4 }} title={false} />
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className={styles.empty}>
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return (
      <>
        <div
          className={
            drawerMode
              ? `${styles.listBody} ${styles.drawerListBody}`
              : styles.listBody
          }
        >
          {messages.map((item) => {
            const unread = isUnread(item);
            return (
              <div
                className={
                  unread ? `${styles.item} ${styles.unreadItem}` : styles.item
                }
                key={String(item.messageId)}
                onClick={() => {
                  void markMessageRead(item);
                }}
              >
                <div className={styles.itemMeta}>
                  <span className={styles.itemState}>
                    <span
                      className={unread ? styles.dot : styles.dotPlaceholder}
                    />
                    {unread ? '未读' : '已读'}
                  </span>
                  <span className={styles.itemTime}>
                    {formatMessageTime(item.createTime)}
                  </span>
                </div>
                <SafeHtml className={styles.content} html={item.contentHtml} />
              </div>
            );
          })}
        </div>
        <div className={styles.footer}>
          {hasMore ? (
            <Button
              block
              loading={loadingMore}
              onClick={() => {
                void loadMessages({ append: true, page: pageNum + 1 });
              }}
            >
              加载更多
            </Button>
          ) : (
            <div className={styles.allLoaded}>已加载全部</div>
          )}
        </div>
      </>
    );
  };

  const renderPanel = (drawerMode = false) => (
    <div
      className={
        drawerMode ? `${styles.panel} ${styles.drawerPanel}` : styles.panel
      }
    >
      <div className={styles.header}>
        <span className={styles.title}>通知中心</span>
        <span className={styles.headerActions}>
          <Button
            disabled={unreadCount <= 0}
            icon={<CheckCircleOutlined />}
            loading={markingAll}
            size="small"
            type="text"
            onClick={() => {
              void handleReadAll();
            }}
          >
            全部已读
          </Button>
          {drawerMode ? (
            <Button
              aria-label="关闭通知中心"
              icon={<CloseOutlined />}
              size="small"
              type="text"
              onClick={() => setOpen(false)}
            />
          ) : null}
        </span>
      </div>
      <div className={styles.filters}>
        <Segmented
          block
          options={[
            { label: '全部', value: 'all' },
            { label: '未读', value: 'unread' },
          ]}
          value={activeFilter}
          onChange={handleFilterChange}
        />
      </div>
      {renderList(drawerMode)}
    </div>
  );

  if (!enabled) {
    return null;
  }

  if (isMobile) {
    return (
      <>
        <Tooltip title="通知">
          {renderTrigger(() => {
            openPanel();
          })}
        </Tooltip>
        <Drawer
          closable={false}
          open={open}
          placement="right"
          styles={{ body: { padding: 0 } }}
          width={360}
          onClose={() => setOpen(false)}
        >
          {renderPanel(true)}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      content={renderPanel(false)}
      open={open}
      placement="bottomRight"
      trigger="click"
      onOpenChange={handleOpenChange}
    >
      <Tooltip title="通知">{renderTrigger()}</Tooltip>
    </Popover>
  );
};

export default NotificationCenter;
