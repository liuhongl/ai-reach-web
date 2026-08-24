import {
  CheckCircleFilled,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  PlusOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Form,
  Input,
  List,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { ListPage, TableCard } from '@/components/ListLayout';
import { usePermission } from '@/components/Permission';
import {
  type AiCallLabPromptProfile,
  getAiCallLabPromptProfiles,
} from '@/services/ruoyi/ai-call-lab';
import OfficePreview from './OfficePreview';
import {
  deleteKnowledgeItem,
  downloadKnowledgeVersion,
  hashKnowledgeFile,
  type KnowledgeContentCategory,
  type KnowledgeItem,
  type KnowledgeItemPatch,
  type KnowledgeSceneBinding,
  type KnowledgeVersion,
  listKnowledgeItems,
  listKnowledgeVersions,
  previewKnowledgeVersion,
  replaceKnowledgeSceneBindings,
  retryKnowledgeVersion,
  updateKnowledgeItem,
  uploadKnowledgeItem,
} from './service';
import './index.less';

const { Text } = Typography;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const UPLOAD_ACCEPT =
  '.txt,.md,.markdown,.pptx,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf';
const PREVIEWABLE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'pdf',
  'docx',
  'pptx',
]);

type ContentCategoryFilter = KnowledgeContentCategory | 'ALL';
type MediaCategory = 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'IMAGE';

const mediaCategoryOptions: Array<{
  label: string;
  value: MediaCategory | 'ALL';
  disabled?: boolean;
}> = [
  { label: '全部', value: 'ALL' },
  { label: '文档库', value: 'DOCUMENT' },
  { label: '视频库', value: 'VIDEO', disabled: true },
  { label: '音频库', value: 'AUDIO', disabled: true },
  { label: '图片库', value: 'IMAGE', disabled: true },
];

const categoryOptions: Array<{
  label: string;
  value: KnowledgeContentCategory;
}> = [
  { label: '产品&服务', value: 'PRODUCT_SERVICE' },
  { label: 'FAQ', value: 'FAQ' },
  { label: '专业沉淀（含案例）', value: 'PROFESSIONAL' },
  { label: '行业知识', value: 'INDUSTRY' },
  { label: '其他', value: 'OTHER' },
];

const contentCategoryOptions: Array<{
  label: string;
  value: ContentCategoryFilter;
}> = [{ label: '全部', value: 'ALL' }, ...categoryOptions];

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

const buildBindingOptions = (
  bindings: KnowledgeSceneBinding[],
  profiles: AiCallLabPromptProfile[],
) =>
  Array.from(
    new Map(
      [
        ...bindings.map((binding) => ({
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

type UploadValues = {
  contentCategory: KnowledgeContentCategory;
  note?: string;
};

type NoteValues = Pick<KnowledgeItemPatch, 'note'>;

type PendingUpload = {
  fingerprint: string;
  key: string;
};

const AiCallKnowledgePage = () => {
  const actionRef = useRef<ActionType>(null);
  const pendingUploadRef = useRef<PendingUpload | undefined>(undefined);
  const contentFilterMountedRef = useRef(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const { token } = theme.useToken();
  const { hasPermission } = usePermission();
  const canManage = hasPermission('ai_call:knowledge:manage');
  const [uploadForm] = Form.useForm<UploadValues>();
  const [editForm] = Form.useForm<NoteValues>();
  const [hasProcessing, setHasProcessing] = useState(false);
  const [contentCategoryFilter, setContentCategoryFilter] =
    useState<ContentCategoryFilter>('ALL');
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<
    MediaCategory | 'ALL'
  >('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<KnowledgeItem>();
  const [uploadFile, setUploadFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem>();
  const [savingEdit, setSavingEdit] = useState(false);
  const [versionItem, setVersionItem] = useState<KnowledgeItem>();
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [profiles, setProfiles] = useState<AiCallLabPromptProfile[]>([]);
  const [bindingRowId, setBindingRowId] = useState<string>();
  const uploadExtensionIndex = uploadFile?.name.lastIndexOf('.') ?? -1;
  const uploadFileName =
    uploadFile?.name.slice(0, uploadExtensionIndex) || uploadFile?.name;
  const uploadFileExtension =
    uploadExtensionIndex > 0
      ? uploadFile?.name.slice(uploadExtensionIndex)
      : '';

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setInterval(
      () => void actionRef.current?.reload(),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [hasProcessing]);

  useEffect(() => {
    if (!contentFilterMountedRef.current) {
      contentFilterMountedRef.current = true;
      return;
    }
    void actionRef.current?.reloadAndRest?.();
  }, [contentCategoryFilter]);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    void getAiCallLabPromptProfiles()
      .then((result) => {
        if (active) setProfiles(result.rows);
      })
      .catch(() => {
        if (active) {
          setProfiles([]);
          messageApi.warning('场景列表加载失败，知识列表仍可查看');
        }
      });
    return () => {
      active = false;
    };
  }, [canManage, messageApi]);

  const openVersionHistory = async (item: KnowledgeItem) => {
    setVersionItem(item);
    setVersionsLoading(true);
    setVersions([]);
    try {
      setVersions(await listKnowledgeVersions(item.id));
    } catch {
      setVersionItem(undefined);
      messageApi.error('版本记录加载失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const openUpload = (item?: KnowledgeItem, file?: File) => {
    setUploadTarget(item);
    setUploadFile(file);
    pendingUploadRef.current = undefined;
    uploadForm.setFieldsValue({
      contentCategory: item?.contentCategory || 'FAQ',
      note: '',
    });
    setUploadOpen(true);
  };

  const selectUploadFile = (file: File, openModal = false) => {
    if (!/\.(txt|md|markdown|pptx|docx|pdf)$/i.test(file.name)) {
      messageApi.warning('当前支持 TXT、Markdown、PPTX、DOCX 和文本型 PDF');
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
    if (openModal) openUpload(undefined, file);
    else {
      setUploadFile(file);
      pendingUploadRef.current = undefined;
    }
    return false;
  };

  const submitUpload = async () => {
    let values: UploadValues;
    try {
      values = await uploadForm.validateFields();
    } catch {
      return;
    }
    if (!uploadFile) {
      messageApi.warning('请选择 TXT、Markdown、PPTX、DOCX 或文本型 PDF 文件');
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
      messageApi.success(
        uploadTarget ? '新版本已进入处理队列' : '知识文件已进入处理队列',
      );
      await actionRef.current?.reload();
    } catch {
      messageApi.error('上传失败，请检查文件后重试');
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (item: KnowledgeItem) => {
    editForm.setFieldsValue({
      note: item.note || '',
    });
    setEditingItem(item);
  };

  const submitEdit = async () => {
    if (!editingItem) return;
    let values: NoteValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setSavingEdit(true);
    try {
      await updateKnowledgeItem(editingItem.id, values);
      setEditingItem(undefined);
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
      const extension = version.extension.toLowerCase();
      const blob = await previewKnowledgeVersion(version.id, extension);
      if (extension === 'docx' || extension === 'pptx') {
        Modal.info({
          width: 1100,
          title: `${version.sourceFilename} · v${version.versionNo}`,
          content: <OfficePreview blob={blob} extension={extension} />,
        });
        return;
      }
      if (extension === 'pdf') {
        const url = window.URL.createObjectURL(blob);
        Modal.info({
          width: 1000,
          title: `${version.sourceFilename} · v${version.versionNo}`,
          content: (
            <iframe
              title={`${version.sourceFilename} 预览`}
              src={url}
              style={{ width: '100%', height: '70vh', border: 0 }}
            />
          ),
          afterClose: () => window.URL.revokeObjectURL(url),
        });
        return;
      }
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

  const previewCurrentFile = async (item: KnowledgeItem) => {
    let version = item.latestVersion;
    if (
      version.status !== 'READY' &&
      item.currentReadyVersionId &&
      item.currentReadyVersionId !== version.id
    ) {
      try {
        const history = await listKnowledgeVersions(item.id);
        version =
          history.find(({ id }) => id === item.currentReadyVersionId) ||
          version;
      } catch {
        messageApi.error('文件预览信息加载失败');
        return;
      }
    }

    if (version.status === 'FAILED') {
      messageApi.error(
        version.failureMessage || '文件处理失败，请在版本记录中重试',
      );
      return;
    }
    if (version.status !== 'READY') {
      messageApi.info('文件正在处理，暂不可预览');
      return;
    }
    if (!PREVIEWABLE_EXTENSIONS.has(version.extension.toLowerCase())) {
      messageApi.info('当前文件格式暂不支持在线预览，请在版本记录中下载');
      return;
    }
    await previewVersion(version);
  };

  const saveRowBindings = async (
    item: KnowledgeItem,
    promptProfileIds: string[],
  ) => {
    setBindingRowId(item.id);
    try {
      await replaceKnowledgeSceneBindings(item.id, promptProfileIds);
      messageApi.success('关联场景已更新');
      await actionRef.current?.reload();
    } catch {
      messageApi.error('关联场景更新失败');
    } finally {
      setBindingRowId(undefined);
    }
  };

  const retryVersion = async (version: KnowledgeVersion) => {
    try {
      await retryKnowledgeVersion(version.id);
      messageApi.success('已重新进入处理队列');
      if (versionItem) await openVersionHistory(versionItem);
      await actionRef.current?.reload();
    } catch {
      messageApi.error('该版本暂时无法重试');
    }
  };

  const removeItem = async (item: KnowledgeItem) => {
    try {
      await deleteKnowledgeItem(item.id);
      if (versionItem?.id === item.id) setVersionItem(undefined);
      messageApi.success('知识条目已删除');
      await actionRef.current?.reloadAndRest?.();
    } catch {
      messageApi.error('知识条目删除失败');
    }
  };

  const columns: ProColumns<KnowledgeItem>[] = [
    {
      title: '文件名',
      dataIndex: 'displayName',
      width: 260,
      render: (_, item) => {
        return (
          <div className="ai-call-knowledge-file">
            <span className="ai-call-knowledge-file-icon">
              <FileTextOutlined />
            </span>
            <div className="ai-call-knowledge-file-copy">
              <Button
                type="link"
                className="ai-call-knowledge-file-name"
                onClick={() => void previewCurrentFile(item)}
              >
                {item.displayName}
              </Button>
              {item.note ? (
                <Tooltip title={`备注：${item.note}`}>
                  <Tag className="ai-call-knowledge-note" color="orange">
                    备注：{item.note}
                  </Tag>
                </Tooltip>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      title: '载体分类',
      width: 90,
      render: () => <Text type="secondary">文档库</Text>,
    },
    {
      title: '内容分类',
      dataIndex: 'contentCategory',
      width: 130,
      render: (_, item) => (
        <Tag variant="filled">{categoryLabel[item.contentCategory]}</Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_, item) => {
        const meta = statusMeta[item.latestVersion.status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (_, item) => formatDateTime(item.updatedAt),
    },
    {
      title: '关联产品（场景）',
      dataIndex: 'sceneBindings',
      width: 230,
      render: (_, item) => {
        const bindings = item.sceneBindings ?? [];
        return (
          <Select
            mode="multiple"
            className="ai-call-knowledge-scene-select"
            aria-label={`${item.displayName}关联场景`}
            disabled={!canManage}
            loading={bindingRowId === item.id}
            value={bindings.map((binding) => binding.promptProfileId)}
            options={buildBindingOptions(bindings, profiles)}
            placeholder={
              item.bindingCount > 0
                ? `已关联 ${item.bindingCount} 个场景`
                : '未关联'
            }
            maxTagCount="responsive"
            onChange={(values) => void saveRowBindings(item, values)}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: canManage ? 176 : 56,
      fixed: 'right',
      render: (_, item) => (
        <Space size={4}>
          {canManage ? (
            <Tooltip title="上传新版本">
              <Button
                type="text"
                aria-label="上传新版本"
                icon={<UploadOutlined />}
                onClick={() => openUpload(item)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title="版本记录">
            <Button
              type="text"
              aria-label="版本记录"
              icon={<HistoryOutlined />}
              onClick={() => void openVersionHistory(item)}
            />
          </Tooltip>
          {canManage ? (
            <>
              <Tooltip title="添加或修改备注">
                <Button
                  type="text"
                  aria-label="编辑备注"
                  icon={<TagsOutlined />}
                  onClick={() => openEdit(item)}
                />
              </Tooltip>
              <Popconfirm
                title="删除该知识条目？"
                description="删除后将解除所有场景关联，历史外呼快照不受影响。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => removeItem(item)}
              >
                <Tooltip title="删除知识条目">
                  <Button
                    type="text"
                    danger
                    aria-label="删除知识条目"
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <ListPage className="ai-call-knowledge-page">
      {messageContextHolder}
      <div className="ai-call-knowledge-layout">
        <div className="ai-call-knowledge-toolbar">
          <section
            className="ai-call-knowledge-filters"
            aria-label="知识分类筛选"
          >
            <div className="ai-call-knowledge-filter-row">
              <Text strong>媒体分类</Text>
              <div className="ai-call-knowledge-filter-options">
                {mediaCategoryOptions.map((option) => (
                  <Button
                    key={option.value}
                    size="small"
                    autoInsertSpace={false}
                    type={
                      mediaCategoryFilter === option.value ? 'primary' : 'text'
                    }
                    disabled={option.disabled}
                    aria-pressed={mediaCategoryFilter === option.value}
                    onClick={() => setMediaCategoryFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="ai-call-knowledge-filter-row">
              <Text strong>内容分类</Text>
              <div className="ai-call-knowledge-filter-options">
                {contentCategoryOptions.map((option) => (
                  <Button
                    key={option.value}
                    size="small"
                    autoInsertSpace={false}
                    type={
                      contentCategoryFilter === option.value
                        ? 'primary'
                        : 'text'
                    }
                    aria-pressed={contentCategoryFilter === option.value}
                    onClick={() => setContentCategoryFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {canManage ? (
            <Upload.Dragger
              className="ai-call-knowledge-upload-card"
              accept={UPLOAD_ACCEPT}
              showUploadList={false}
              beforeUpload={(file) => selectUploadFile(file, true)}
            >
              <CloudUploadOutlined className="ai-call-knowledge-upload-icon" />
              <Button
                type="primary"
                aria-label="上传新知识"
                icon={<PlusOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  openUpload();
                }}
              >
                上传新知识
              </Button>
              <Text>拖拽文件至此或点击上传</Text>
              <Text type="secondary">
                支持 TXT、MD、PPTX、DOCX、文本型 PDF，最大 100 MB
              </Text>
            </Upload.Dragger>
          ) : null}
        </div>

        <TableCard>
          <ProTable<KnowledgeItem>
            className="recov-stable-pagination-table"
            rowKey="id"
            actionRef={actionRef}
            columns={columns}
            search={false}
            options={false}
            scroll={{ x: 1050 }}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            headerTitle={false}
            toolBarRender={false}
            request={async ({ current, pageSize }) => {
              try {
                const result = await listKnowledgeItems({
                  pageNum: current || 1,
                  pageSize: pageSize || 10,
                  contentCategory:
                    contentCategoryFilter === 'ALL'
                      ? undefined
                      : contentCategoryFilter,
                });
                setHasProcessing(
                  result.rows.some(
                    (item) => item.latestVersion.status === 'PROCESSING',
                  ),
                );
                return {
                  data: result.rows,
                  total: result.total,
                  success: true,
                };
              } catch {
                setHasProcessing(false);
                messageApi.error('知识列表加载失败');
                return { data: [], total: 0, success: false };
              }
            }}
          />
        </TableCard>
      </div>

      <Modal
        title={
          uploadTarget
            ? `上传“${uploadTarget.displayName}”的新版本`
            : '上传知识文件'
        }
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
            {uploadFile ? (
              <div
                aria-live="polite"
                className="flex flex-col gap-3 rounded-lg border px-5 py-4 text-left sm:h-28 sm:flex-row sm:items-center"
                style={{
                  background: token.colorSuccessBg,
                  borderColor: token.colorSuccessBorder,
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CheckCircleFilled
                    className="shrink-0 text-2xl"
                    style={{ color: token.colorSuccess }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">已选择知识文件</div>
                    <Tooltip
                      title={uploadFile.name}
                      trigger={['hover', 'focus', 'click']}
                    >
                      <button
                        aria-label={`完整文件名：${uploadFile.name}`}
                        className="mt-1 flex w-full min-w-0 items-center border-0 bg-transparent p-0 text-left text-gray-500"
                        type="button"
                      >
                        <span className="min-w-0 truncate">
                          {uploadFileName}
                        </span>
                        <span className="shrink-0">{uploadFileExtension}</span>
                        <span className="ml-2 shrink-0">
                          · {formatBytes(uploadFile.size)}
                        </span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:ml-auto">
                  <Upload
                    accept={UPLOAD_ACCEPT}
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => selectUploadFile(file)}
                  >
                    <Button icon={<UploadOutlined />} size="small">
                      重新选择
                    </Button>
                  </Upload>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => {
                      setUploadFile(undefined);
                      pendingUploadRef.current = undefined;
                    }}
                  >
                    移除
                  </Button>
                </div>
              </div>
            ) : (
              <Upload.Dragger
                accept={UPLOAD_ACCEPT}
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => selectUploadFile(file)}
              >
                <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
                  <InboxOutlined style={{ fontSize: 24 }} />
                </p>
                <p style={{ marginBottom: 4 }}>上传知识文件</p>
                <p className="text-gray-500" style={{ marginBottom: 0 }}>
                  支持 TXT、MD、PPTX、DOCX、文本型 PDF（不含扫描件），最大 100
                  MB
                </p>
              </Upload.Dragger>
            )}
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
        title="编辑备注"
        open={Boolean(editingItem)}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingEdit}
        onOk={submitEdit}
        onCancel={() => !savingEdit && setEditingItem(undefined)}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="note" label="备注" rules={[{ max: 1000 }]}>
            <Input.TextArea rows={3} showCount maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${versionItem?.displayName || ''} · 版本记录`}
        width={760}
        open={Boolean(versionItem)}
        footer={null}
        destroyOnHidden
        onCancel={() => setVersionItem(undefined)}
      >
        <Spin spinning={versionsLoading}>
          <List
            bordered
            dataSource={versions}
            renderItem={(version) => {
              const meta = statusMeta[version.status];
              const canPreview = PREVIEWABLE_EXTENSIONS.has(
                version.extension.toLowerCase(),
              );
              return (
                <List.Item
                  actions={[
                    ...(version.status === 'READY' && canPreview
                      ? [
                          <Button
                            key="preview"
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => void previewVersion(version)}
                          >
                            预览
                          </Button>,
                        ]
                      : []),
                    ...(version.status === 'READY'
                      ? [
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
                            onClick={() => void retryVersion(version)}
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
                        <Text type="secondary">
                          {formatBytes(version.byteSize)}
                        </Text>
                        <Text type="secondary">
                          {version.chunkCount} 个切片
                        </Text>
                        <Text type="secondary">
                          {formatDateTime(version.createdAt)}
                        </Text>
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
        </Spin>
      </Modal>
    </ListPage>
  );
};

export default AiCallKnowledgePage;
