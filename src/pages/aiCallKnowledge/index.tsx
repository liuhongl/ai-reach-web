import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { ListPage, TableCard } from '@/components/ListLayout';
import { usePermission } from '@/components/Permission';
import {
  type AiCallLabPromptProfile,
  getAiCallLabPromptProfiles,
} from '@/services/ruoyi/ai-call-lab';
import {
  type KnowledgeContentCategory,
  type KnowledgeItem,
  type KnowledgeItemPatch,
  type KnowledgeVersion,
  deleteKnowledgeItem,
  downloadKnowledgeVersion,
  getKnowledgeItem,
  hashKnowledgeFile,
  listKnowledgeItems,
  listKnowledgeVersions,
  previewKnowledgeVersion,
  replaceKnowledgeSceneBindings,
  retryKnowledgeVersion,
  updateKnowledgeItem,
  uploadKnowledgeItem,
} from './service';

const { Paragraph, Text } = Typography;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const categoryOptions: Array<{
  label: string;
  value: KnowledgeContentCategory;
}> = [
  { label: '产品与服务', value: 'PRODUCT_SERVICE' },
  { label: 'FAQ', value: 'FAQ' },
  { label: '专业沉淀', value: 'PROFESSIONAL' },
  { label: '行业知识', value: 'INDUSTRY' },
  { label: '其他', value: 'OTHER' },
];

const categoryLabel = Object.fromEntries(
  categoryOptions.map((option) => [option.value, option.label]),
) as Record<KnowledgeContentCategory, string>;

const statusMeta = {
  UPLOADING: { color: 'default', label: '上传中' },
  PROCESSING: { color: 'processing', label: '处理中' },
  READY: { color: 'success', label: '可用' },
  FAILED: { color: 'error', label: '失败' },
} as const;

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `knowledge-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type UploadValues = {
  contentCategory: KnowledgeContentCategory;
  note?: string;
};

type PendingUpload = {
  fingerprint: string;
  key: string;
};

const AiCallKnowledgePage = () => {
  const actionRef = useRef<ActionType>(null);
  const pendingUploadRef = useRef<PendingUpload | undefined>(undefined);
  const [messageApi, messageContextHolder] = message.useMessage();
  const { hasPermission } = usePermission();
  const canManage = hasPermission('ai_call:knowledge:manage');
  const [uploadForm] = Form.useForm<UploadValues>();
  const [editForm] = Form.useForm<KnowledgeItemPatch>();
  const [hasProcessing, setHasProcessing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<KnowledgeItem>();
  const [uploadFile, setUploadFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem>();
  const [savingEdit, setSavingEdit] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState<KnowledgeItem>();
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [profiles, setProfiles] = useState<AiCallLabPromptProfile[]>([]);
  const [bindingIds, setBindingIds] = useState<string[]>([]);
  const [savingBindings, setSavingBindings] = useState(false);

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setInterval(() => void actionRef.current?.reload(), 3000);
    return () => window.clearInterval(timer);
  }, [hasProcessing]);

  const loadDetail = async (item: KnowledgeItem) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDetail(undefined);
    setVersions([]);
    try {
      const [nextDetail, nextVersions] = await Promise.all([
        getKnowledgeItem(item.id),
        listKnowledgeVersions(item.id),
      ]);
      setDetail(nextDetail);
      setVersions(nextVersions);
      setBindingIds(
        (nextDetail.sceneBindings || []).map(
          (binding) => binding.promptProfileId,
        ),
      );
      if (canManage) {
        try {
          const result = await getAiCallLabPromptProfiles();
          setProfiles(result.rows);
        } catch {
          setProfiles([]);
          messageApi.warning('场景列表加载失败，其他详情仍可查看');
        }
      }
    } catch {
      messageApi.error('知识详情加载失败');
    } finally {
      setDrawerLoading(false);
    }
  };

  const openUpload = (item?: KnowledgeItem) => {
    setUploadTarget(item);
    setUploadFile(undefined);
    pendingUploadRef.current = undefined;
    uploadForm.setFieldsValue({
      contentCategory: item?.contentCategory || 'FAQ',
      note: '',
    });
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    let values: UploadValues;
    try {
      values = await uploadForm.validateFields();
    } catch {
      return;
    }
    if (!uploadFile) {
      messageApi.warning('请选择 TXT、Markdown 或 PPTX 文件');
      return;
    }
    const fingerprint = [
      uploadTarget?.id || 'new',
      uploadFile.name,
      uploadFile.size,
      uploadFile.lastModified,
      values.contentCategory,
      values.note || '',
    ].join('|');
    const pendingUpload =
      pendingUploadRef.current?.fingerprint === fingerprint
        ? pendingUploadRef.current
        : { fingerprint, key: createIdempotencyKey() };
    pendingUploadRef.current = pendingUpload;

    setUploading(true);
    try {
      const fileSha256 = await hashKnowledgeFile(uploadFile);
      await uploadKnowledgeItem(
        { file: uploadFile, fileSha256, ...values },
        pendingUpload.key,
        uploadTarget?.id,
      );
      pendingUploadRef.current = undefined;
      setUploadOpen(false);
      messageApi.success(uploadTarget ? '新版本已进入处理队列' : '知识文件已进入处理队列');
      await actionRef.current?.reload();
      if (uploadTarget && detail?.id === uploadTarget.id) {
        await loadDetail(uploadTarget);
      }
    } catch {
      messageApi.error('上传失败，请检查文件后重试');
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (item: KnowledgeItem) => {
    editForm.setFieldsValue({
      displayName: item.displayName,
      contentCategory: item.contentCategory,
      note: item.note || '',
    });
    setEditingItem(item);
  };

  const submitEdit = async () => {
    if (!editingItem) return;
    let values: KnowledgeItemPatch;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateKnowledgeItem(editingItem.id, values);
      setEditingItem(undefined);
      if (detail?.id === updated.id) setDetail(updated);
      messageApi.success('知识信息已更新');
      await actionRef.current?.reload();
    } catch {
      messageApi.error('知识信息更新失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const previewVersion = async (version: KnowledgeVersion) => {
    try {
      const blob = await previewKnowledgeVersion(version.id);
      const text = await blob.text();
      Modal.info({
        width: 900,
        title: `${version.sourceFilename} · v${version.versionNo}`,
        content: (
          <div>
            <Alert
              showIcon
              type="info"
              title="在线预览最多显示前 256 KB，下载原文件可查看全文。"
              style={{ marginBottom: 12 }}
            />
            <pre
              style={{
                maxHeight: '60vh',
                margin: 0,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {text}
            </pre>
          </div>
        ),
      });
    } catch {
      messageApi.error('文件预览失败');
    }
  };

  const saveBindings = async () => {
    if (!detail) return;
    setSavingBindings(true);
    try {
      const result = await replaceKnowledgeSceneBindings(detail.id, bindingIds);
      setDetail({
        ...detail,
        sceneBindings: result.sceneBindings,
        bindingCount: result.sceneBindings.length,
      });
      messageApi.success('关联场景已更新');
      await actionRef.current?.reload();
    } catch {
      messageApi.error('关联场景更新失败');
    } finally {
      setSavingBindings(false);
    }
  };

  const retryVersion = async (version: KnowledgeVersion) => {
    try {
      await retryKnowledgeVersion(version.id);
      messageApi.success('已重新进入处理队列');
      if (detail) await loadDetail(detail);
      await actionRef.current?.reload();
    } catch {
      messageApi.error('该版本暂时无法重试');
    }
  };

  const removeItem = async (item: KnowledgeItem) => {
    try {
      await deleteKnowledgeItem(item.id);
      if (detail?.id === item.id) setDrawerOpen(false);
      messageApi.success('知识条目已删除');
      await actionRef.current?.reloadAndRest?.();
    } catch {
      messageApi.error('知识条目删除失败');
    }
  };

  const bindingOptions = Array.from(
    new Map(
      [
        ...(detail?.sceneBindings || []).map((binding) => ({
          value: binding.promptProfileId,
          label: `${binding.name} · ${binding.sceneCode}`,
        })),
        ...profiles
          .filter((profile) => profile.id !== undefined)
          .map((profile) => ({
            value: String(profile.id),
            label: `${profile.name} · ${profile.sceneCode}`,
          })),
      ].map((option) => [option.value, option]),
    ).values(),
  );

  const columns: ProColumns<KnowledgeItem>[] = [
    {
      title: '知识名称',
      dataIndex: 'displayName',
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => loadDetail(item)}>
            {item.displayName}
          </Button>
          {item.note ? <Text type="secondary">{item.note}</Text> : null}
        </Space>
      ),
    },
    {
      title: '内容分类',
      dataIndex: 'contentCategory',
      width: 120,
      render: (_, item) => categoryLabel[item.contentCategory],
    },
    {
      title: '处理状态',
      dataIndex: ['latestVersion', 'status'],
      width: 140,
      render: (_, item) => {
        const meta = statusMeta[item.latestVersion.status];
        return (
          <Space direction="vertical" size={0}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {item.latestVersion.failureMessage ? (
              <Text type="danger">{item.latestVersion.failureMessage}</Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: '当前版本',
      width: 130,
      render: (_, item) => (
        <Space direction="vertical" size={0}>
          <Text>v{item.latestVersion.versionNo}</Text>
          <Text type="secondary">{item.latestVersion.chunkCount} 个切片</Text>
        </Space>
      ),
    },
    {
      title: '关联场景',
      dataIndex: 'bindingCount',
      width: 100,
      render: (_, item) => `${item.bindingCount} 个`,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (_, item) => formatDateTime(item.updatedAt),
    },
    {
      title: '操作',
      key: 'actions',
      width: canManage ? 300 : 80,
      fixed: 'right',
      render: (_, item) => (
        <Space size={0} wrap>
          <Button type="link" onClick={() => loadDetail(item)}>
            详情
          </Button>
          {canManage ? (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(item)}>
                编辑
              </Button>
              <Button type="link" icon={<UploadOutlined />} onClick={() => openUpload(item)}>
                新版本
              </Button>
              <Popconfirm
                title="删除该知识条目？"
                description="删除后将解除所有场景关联，历史外呼快照不受影响。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => removeItem(item)}
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <ListPage>
      {messageContextHolder}
      <TableCard>
        <ProTable<KnowledgeItem>
          rowKey="id"
          actionRef={actionRef}
          columns={columns}
          search={false}
          options={false}
          scroll={{ x: 1080 }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          headerTitle="知识资产"
          toolBarRender={() => [
            <Button
              key="reload"
              icon={<ReloadOutlined />}
              onClick={() => actionRef.current?.reload()}
            >
              刷新
            </Button>,
            canManage ? (
              <Button
                key="upload"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openUpload()}
              >
                上传知识
              </Button>
            ) : null,
          ]}
          request={async ({ current, pageSize }) => {
            try {
              const result = await listKnowledgeItems({
                pageNum: current || 1,
                pageSize: pageSize || 20,
              });
              setHasProcessing(
                result.rows.some(
                  (item) => item.latestVersion.status === 'PROCESSING',
                ),
              );
              return { data: result.rows, total: result.total, success: true };
            } catch {
              setHasProcessing(false);
              messageApi.error('知识列表加载失败');
              return { data: [], total: 0, success: false };
            }
          }}
        />
      </TableCard>

      <Modal
        title={uploadTarget ? `上传“${uploadTarget.displayName}”的新版本` : '上传知识文件'}
        open={uploadOpen}
        okText="开始上传"
        cancelText="取消"
        confirmLoading={uploading}
        destroyOnHidden
        onOk={submitUpload}
        onCancel={() => !uploading && setUploadOpen(false)}
      >
        <Form form={uploadForm} layout="vertical" preserve={false}>
          <Form.Item label="文件" required>
            <Upload.Dragger
              accept=".txt,.md,.markdown,.pptx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              maxCount={1}
              beforeUpload={(file) => {
                if (!/\.(txt|md|markdown|pptx)$/i.test(file.name)) {
                  messageApi.warning('当前只支持 TXT、Markdown 和 PPTX');
                  return Upload.LIST_IGNORE;
                }
                if (file.size === 0) {
                  messageApi.warning('文件不能为空');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > MAX_UPLOAD_BYTES) {
                  messageApi.warning('文件不能超过 100 MB');
                  return Upload.LIST_IGNORE;
                }
                setUploadFile(file);
                return false;
              }}
              onRemove={() => {
                setUploadFile(undefined);
                pendingUploadRef.current = undefined;
              }}
            >
              <Paragraph style={{ marginBottom: 4 }}>点击或拖拽文件到此处</Paragraph>
              <Text type="secondary">支持 TXT、MD、PPTX，最大 100 MB</Text>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item
            name="contentCategory"
            label="内容分类"
            rules={[{ required: true, message: '请选择内容分类' }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="note" label="备注" rules={[{ max: 1000 }]}>
            <Input.TextArea rows={3} showCount maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑知识信息"
        open={Boolean(editingItem)}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingEdit}
        onOk={submitEdit}
        onCancel={() => !savingEdit && setEditingItem(undefined)}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="displayName"
            label="知识名称"
            rules={[{ required: true, whitespace: true }, { max: 255 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="contentCategory"
            label="内容分类"
            rules={[{ required: true }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="note" label="备注" rules={[{ max: 1000 }]}>
            <Input.TextArea rows={3} showCount maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detail?.displayName || '知识详情'}
        size="large"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          canManage && detail ? (
            <Button icon={<UploadOutlined />} onClick={() => openUpload(detail)}>
              上传新版本
            </Button>
          ) : null
        }
      >
        <Spin spinning={drawerLoading}>
          {detail ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Descriptions
                bordered
                size="small"
                column={2}
                items={[
                  { key: 'category', label: '内容分类', children: categoryLabel[detail.contentCategory] },
                  { key: 'versions', label: '版本数', children: detail.versionCount },
                  { key: 'bindings', label: '关联场景', children: detail.bindingCount },
                  { key: 'updated', label: '更新时间', children: formatDateTime(detail.updatedAt) },
                  { key: 'note', label: '备注', span: 2, children: detail.note || '-' },
                ]}
              />

              <section style={{ width: '100%' }}>
                <Text strong>关联场景</Text>
                <Space.Compact style={{ display: 'flex', marginTop: 8 }}>
                  <Select
                    mode="multiple"
                    style={{ flex: 1 }}
                    disabled={!canManage}
                    value={bindingIds}
                    placeholder="暂未关联场景"
                    options={bindingOptions}
                    onChange={setBindingIds}
                  />
                  {canManage ? (
                    <Button type="primary" loading={savingBindings} onClick={saveBindings}>
                      保存关联
                    </Button>
                  ) : null}
                </Space.Compact>
              </section>

              <section style={{ width: '100%' }}>
                <Text strong>历史版本</Text>
                <List
                  style={{ marginTop: 8 }}
                  bordered
                  dataSource={versions}
                  renderItem={(version) => {
                    const meta = statusMeta[version.status];
                    return (
                      <List.Item
                        actions={[
                          ...(version.status === 'READY'
                            ? [
                                <Button
                                  key="preview"
                                  type="link"
                                  icon={<EyeOutlined />}
                                  onClick={() => previewVersion(version)}
                                >
                                  预览
                                </Button>,
                                <Button
                                  key="download"
                                  type="link"
                                  icon={<DownloadOutlined />}
                                  onClick={() =>
                                    downloadKnowledgeVersion(
                                      version.id,
                                      version.sourceFilename,
                                    ).catch(() => messageApi.error('文件下载失败'))
                                  }
                                >
                                  下载
                                </Button>,
                              ]
                            : []),
                          ...(canManage && version.failureRetryable
                            ? [
                                <Button
                                  key="retry"
                                  type="link"
                                  onClick={() => retryVersion(version)}
                                >
                                  重试
                                </Button>,
                              ]
                            : []),
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <Text>v{version.versionNo}</Text>
                              <Tag color={meta.color}>{meta.label}</Tag>
                              <Text>{version.sourceFilename}</Text>
                            </Space>
                          }
                          description={
                            <Space wrap>
                              <Text type="secondary">{formatBytes(version.byteSize)}</Text>
                              <Text type="secondary">{version.chunkCount} 个切片</Text>
                              <Text type="secondary">{formatDateTime(version.createdAt)}</Text>
                              {version.failureMessage ? (
                                <Text type="danger">{version.failureMessage}</Text>
                              ) : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </section>
            </Space>
          ) : null}
        </Spin>
      </Drawer>
    </ListPage>
  );
};

export default AiCallKnowledgePage;
