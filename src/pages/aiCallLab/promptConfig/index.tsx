import {
  CloseOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  message,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage, TableCard } from '@/components/ListLayout';
import { usePermission } from '@/components/Permission';
import {
  type AiCallLabProductInfoDraft,
  type AiCallLabPromptProfile,
  type AiCallLabPromptVariable,
  type AiCallLabPromptVersion,
  applyAiCallLabPromptVersion,
  deleteAiCallLabPromptVersion,
  extractAiCallLabProductInfo,
  getAiCallLabPromptCommonConfig,
  getAiCallLabPromptProfiles,
  getAiCallLabPromptVersion,
  getAiCallLabPromptVersions,
  optimizeAiCallLabPrompt,
  previewAiCallLabPromptProfile,
  saveAiCallLabPromptCommonConfig,
  saveAiCallLabPromptProfile,
  updateAiCallLabPromptVersionName,
} from '@/services/ruoyi/ai-call-lab';
import VariableEditor from './VariableEditor';
import './index.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

const SCENE_SECTION_DEFAULTS = [
  [
    '## 二、业务信息',
    '以“产品&服务总结”为事实来源；资料未明确的价格、效果、案例、部署和合规问题，不自行承诺，说明需要业务顾问进一步确认。',
  ],
  [
    '## 三、沟通规则',
    `1. 使用简洁、自然的口语，一次只表达一个重点或提出一个问题。
2. 先回应客户当前问题，再推进下一步，不机械朗读整段资料。
3. 不编造知识库和产品总结中没有的事实；无法确认时如实说明。
4. 客户打断时立即停止当前表达，优先听完并回应客户。`,
  ],
  [
    '## 四、对话流程',
    `1. 确认客户是否方便沟通。
2. 了解客户当前情况、关注点或主要问题。
3. 根据客户回答介绍最相关的两到三个产品能力，不做无关展开。
4. 客户有兴趣时邀请预约演示或转人工顾问；暂不方便时询问合适的回访时间。`,
  ],
  [
    '## 五、常见异议',
    `1. “现在没时间”：简短致歉，并询问是否需要另约时间。
2. “暂时不需要”：确认主要原因，不反复劝说。
3. “效果、价格、案例怎么样”：只依据已确认资料回答；资料不足时转业务顾问确认。
4. “和 SEO 有什么区别”：简要说明 SEO 偏搜索排序，GEO 偏生成式答案中的理解、引用和推荐。`,
  ],
  [
    '## 六、完成与结束条件',
    `1. 客户明确有兴趣：确认下一步，预约演示或转人工顾问。
2. 客户暂不方便：记录合适的回访时间后礼貌结束。
3. 客户明确无兴趣或要求结束：停止推介并礼貌结束。
4. 关键信息无法确认：说明需要业务顾问进一步确认，不猜测作答。`,
  ],
] as const;

const DEFAULT_SCENE_PROMPT = [
  '## 一、角色与任务',
  '',
  ...SCENE_SECTION_DEFAULTS.flatMap(([heading, content]) => [
    heading,
    content,
    '',
  ]),
]
  .join('\n')
  .trim();

const fillEmptySceneSections = (prompt: string) =>
  SCENE_SECTION_DEFAULTS.reduce((current, [heading, content]) => {
    const pattern = new RegExp(`(${heading})([\\s\\S]*?)(?=\\n## |$)`);
    return current.replace(pattern, (section, title, body) =>
      body.trim() ? section : `${title}\n${content}\n`,
    );
  }, prompt);

const emptyProfile: AiCallLabPromptProfile = {
  name: '',
  sceneCode: '',
  providerKey: 'static_profile',
  promptText: DEFAULT_SCENE_PROMPT,
  openingMessage: '',
  productInfo: '',
  variables: [],
  versionCount: 0,
};

const normalizeProfile = (
  profile: AiCallLabPromptProfile,
): AiCallLabPromptProfile => {
  const prompt = profile.promptText?.trim() || '';
  const existingVariables = profile.variables || [];
  const referencedKeys = Array.from(
    new Set(
      Array.from(
        `${profile.openingMessage || ''}\n${profile.productInfo || ''}\n${prompt}`.matchAll(
          /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g,
        ),
        (match) => match[1],
      ),
    ),
  );
  return {
    ...emptyProfile,
    ...profile,
    providerKey: 'static_profile',
    variables: [
      ...existingVariables,
      ...referencedKeys
        .filter((key) => !existingVariables.some((item) => item.key === key))
        .map((key) => ({
          key,
          label: key === 'customerName' ? '客户名称' : key,
        })),
    ],
    promptText: fillEmptySceneSections(
      prompt.includes('## 一、角色与任务')
        ? prompt
        : prompt
          ? DEFAULT_SCENE_PROMPT.replace(
              '## 一、角色与任务',
              `## 一、角色与任务\n${prompt}`,
            )
          : DEFAULT_SCENE_PROMPT,
    ),
  };
};

const profileKey = (profile: AiCallLabPromptProfile) =>
  String(profile.id ?? profile.sceneCode);

const replaceCommunicationRules = (prompt: string, common: string) => {
  const replacement = `## 三、沟通规则\n${common.trim()}`;
  return /## 三、沟通规则[\s\S]*?(?=\n## 四、对话流程)/.test(prompt)
    ? prompt.replace(
        /## 三、沟通规则[\s\S]*?(?=\n## 四、对话流程)/,
        replacement,
      )
    : `${prompt.trim()}\n\n${replacement}`;
};

const creationMethodText: Record<string, string> = {
  manual: '人工编辑',
  ai_generated: 'AI 生成',
  ai_optimized: 'AI 优化',
  restored: '应用历史版本',
};

const providerText: Record<string, string> = {
  static_profile: '固定场景配置',
  business_query: '业务查询',
};

const AiCallLabPromptConfigPage = () => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const { hasPermission } = usePermission();
  const canManageKnowledge = hasPermission('ai_call:knowledge:manage');
  const [profiles, setProfiles] = useState<AiCallLabPromptProfile[]>([]);
  const [selectedProfile, setSelectedProfile] =
    useState<AiCallLabPromptProfile>(emptyProfile);
  const [commonPrompt, setCommonPrompt] = useState('');
  const [versions, setVersions] = useState<AiCallLabPromptVersion[]>([]);
  const [sceneDirty, setSceneDirty] = useState(false);
  const [commonDirty, setCommonDirty] = useState(false);
  const [createOrigin, setCreateOrigin] =
    useState<AiCallLabPromptProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCommon, setSavingCommon] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [variableDraft, setVariableDraft] = useState<AiCallLabPromptVariable>({
    key: '',
    label: '',
  });
  const [aiTarget, setAiTarget] = useState<'opening' | 'scenePrompt' | null>(
    null,
  );
  const [aiCandidate, setAiCandidate] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [productDraft, setProductDraft] =
    useState<AiCallLabProductInfoDraft | null>(null);
  const [productDraftLoading, setProductDraftLoading] = useState(false);
  const [knowledgeSnapshotHash, setKnowledgeSnapshotHash] = useState<string>();

  const updateSelectedProfile = (patch: Partial<AiCallLabPromptProfile>) => {
    setSelectedProfile((current) => ({ ...current, ...patch }));
    setSceneDirty(true);
  };

  const loadVersions = useCallback(async (profileId?: string | number) => {
    if (!profileId) {
      setVersions([]);
      return;
    }
    const result = await getAiCallLabPromptVersions(profileId);
    setVersions(result.rows);
  }, []);

  const applyProfile = useCallback(
    (profile: AiCallLabPromptProfile) => {
      const normalized = normalizeProfile(profile);
      setSelectedProfile(normalized);
      setSceneDirty(false);
      setProductDraft(null);
      setKnowledgeSnapshotHash(undefined);
      void loadVersions(normalized.id);
    },
    [loadVersions],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResult, commonResult] = await Promise.all([
        getAiCallLabPromptProfiles(),
        getAiCallLabPromptCommonConfig(),
      ]);
      setProfiles(profileResult.rows);
      setCommonPrompt(commonResult.content || '');
      setCommonDirty(false);
      applyProfile(profileResult.rows[0] || emptyProfile);
    } catch {
      messageApi.error('提示词配置加载失败');
    } finally {
      setLoading(false);
    }
  }, [applyProfile, messageApi]);

  useEffect(() => void loadData(), [loadData]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!sceneDirty && !commonDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [commonDirty, sceneDirty]);

  const confirmSceneDiscard = (onOk: () => void) => {
    if (!sceneDirty) return onOk();
    Modal.confirm({
      title: '当前场景有未保存修改',
      content: '继续操作将丢失这些修改。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk,
    });
  };

  const handleSaveProfile = async () => {
    if (!selectedProfile.name.trim() || !selectedProfile.sceneCode.trim()) {
      messageApi.warning('请填写场景名称和场景编码');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAiCallLabPromptProfile({
        id: selectedProfile.id,
        name: selectedProfile.name.trim(),
        sceneCode: selectedProfile.sceneCode.trim(),
        providerKey: 'static_profile',
        promptText: selectedProfile.promptText?.trim() || '',
        openingMessage: selectedProfile.openingMessage?.trim() || '',
        productInfo: selectedProfile.productInfo?.trim() || '',
        variables: selectedProfile.variables || [],
        knowledgeVersionSnapshotHash: knowledgeSnapshotHash,
      });
      setProfiles((current) => {
        const found = current.some(
          (item) => String(item.id) === String(saved.id),
        );
        return found
          ? current.map((item) =>
              String(item.id) === String(saved.id) ? saved : item,
            )
          : [saved, ...current];
      });
      applyProfile(saved);
      setCreateOrigin(null);
      messageApi.success('场景配置已保存并生成新版本');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      messageApi.error(
        detail.includes('知识资料已变化')
          ? '知识资料已变化，请重新生成产品与服务草稿后再保存'
          : '场景配置保存失败',
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await previewAiCallLabPromptProfile(selectedProfile);
      Modal.info({
        width: 900,
        title: '业务内容预览',
        content: (
          <div className="ai-call-prompt-preview-modal">
            <Text strong>开场白</Text>
            <div className="ai-call-prompt-readonly">
              {result.openingMessage}
            </div>
            <Text strong>产品信息与场景提示词</Text>
            <pre className="ai-call-prompt-preview">{result.instructions}</pre>
            <Alert
              type="info"
              showIcon
              title="平台安全、转人工和结束通话约束由后端维护，不在业务预览中展示。"
            />
          </div>
        ),
      });
    } catch {
      messageApi.error('草稿预览失败，请检查变量和必填内容');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExtractProductInfo = async () => {
    if (!selectedProfile.id) {
      messageApi.warning('请先保存场景，再关联知识并生成草稿');
      return;
    }
    setProductDraftLoading(true);
    try {
      setProductDraft(await extractAiCallLabProductInfo(selectedProfile.id));
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : '产品与服务草稿生成失败',
      );
    } finally {
      setProductDraftLoading(false);
    }
  };

  const handleApplyCommon = () => {
    if (!commonPrompt.trim()) {
      messageApi.warning('通用提示词为空，无法应用');
      return;
    }
    const next = replaceCommunicationRules(
      selectedProfile.promptText || DEFAULT_SCENE_PROMPT,
      commonPrompt,
    );
    Modal.confirm({
      width: 860,
      title: '替换当前场景的沟通规则？',
      content: (
        <div className="ai-call-prompt-compare">
          <div>
            <Text strong>当前内容</Text>
            <pre>{selectedProfile.promptText}</pre>
          </div>
          <div>
            <Text strong>应用后</Text>
            <pre>{next}</pre>
          </div>
        </div>
      ),
      okText: '确认应用',
      onOk: () => updateSelectedProfile({ promptText: next }),
    });
  };

  const variables = selectedProfile.variables || [];
  const referencedTokens = useMemo(
    () =>
      `${selectedProfile.openingMessage || ''}\n${selectedProfile.promptText || ''}`,
    [selectedProfile.openingMessage, selectedProfile.promptText],
  );

  const addVariable = () => {
    const key = variableDraft.key.trim();
    const label = variableDraft.label.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || !label) {
      messageApi.warning('变量需填写中文名称和合法 camelCase 标识');
      return;
    }
    if (variables.some((item) => item.key === key || item.label === label)) {
      messageApi.warning('变量标识或名称已存在');
      return;
    }
    updateSelectedProfile({ variables: [...variables, { key, label }] });
    setVariableDraft({ key: '', label: '' });
    setVariableModalOpen(false);
  };

  const deleteVariable = (variable: AiCallLabPromptVariable) => {
    if (referencedTokens.includes(`{{${variable.key}}}`)) {
      messageApi.warning(`请先从开场白和场景提示词中删除“${variable.label}”`);
      return;
    }
    updateSelectedProfile({
      variables: variables.filter((item) => item.key !== variable.key),
    });
  };

  const closeAiModal = () => {
    setAiTarget(null);
    setAiCandidate('');
    setAiInstruction('');
  };

  const runAiOptimize = async (
    target: 'opening' | 'scenePrompt',
    instruction = '',
  ) => {
    const currentContent =
      target === 'opening'
        ? selectedProfile.openingMessage || ''
        : selectedProfile.promptText || '';
    setAiTarget(target);
    setAiLoading(true);
    try {
      const result = await optimizeAiCallLabPrompt({
        targetType: target,
        currentContent,
        sceneContext: {
          sceneName: selectedProfile.name,
          productInfo: selectedProfile.productInfo || '',
          commonPrompt,
          variables,
        },
        instruction: instruction.trim() || undefined,
      });
      const candidate = result.candidateContent.trim();
      if (candidate === currentContent.trim()) {
        closeAiModal();
        messageApi.info('本次未生成有效变化，可填写具体要求后重试');
        return;
      }
      setAiCandidate(candidate);
    } catch (error) {
      closeAiModal();
      messageApi.error(
        error instanceof Error
          ? error.message
          : 'AI 优化失败，原内容未发生变化',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const showVersion = async (
    version: AiCallLabPromptVersion,
    compare = false,
  ) => {
    if (!selectedProfile.id) return;
    const detail = await getAiCallLabPromptVersion(
      selectedProfile.id,
      version.id,
    );
    const snapshot: Partial<AiCallLabPromptProfile> = detail.snapshot || {};
    Modal.info({
      width: compare ? 1000 : 760,
      title: `v${version.versionNo} · ${detail.versionName || snapshot.name || selectedProfile.name}${compare ? ' 与当前草稿对比' : ''}`,
      content: compare ? (
        <div className="ai-call-prompt-compare">
          <div>
            <Text strong>历史版本</Text>
            <pre>{snapshot.promptText || ''}</pre>
          </div>
          <div>
            <Text strong>当前草稿</Text>
            <pre>{selectedProfile.promptText || ''}</pre>
          </div>
        </div>
      ) : (
        <div className="ai-call-prompt-version-detail">
          <Descriptions
            bordered
            size="small"
            column={2}
            items={[
              {
                key: 'name',
                label: '场景名称',
                children: snapshot.name || '—',
              },
              {
                key: 'sceneCode',
                label: '场景编码',
                children: snapshot.sceneCode || '—',
              },
              {
                key: 'providerKey',
                label: '配置方式',
                children:
                  providerText[snapshot.providerKey || ''] ||
                  snapshot.providerKey ||
                  '—',
              },
              {
                key: 'variables',
                label: '业务变量',
                children:
                  snapshot.variables?.map((item) => item.label).join('、') ||
                  '无',
              },
            ]}
          />
          <Text strong>开场白</Text>
          <div className="ai-call-prompt-readonly">
            {snapshot.openingMessage || '—'}
          </div>
          <Text strong>产品与服务总结</Text>
          <div className="ai-call-prompt-readonly">
            {snapshot.productInfo || '—'}
          </div>
          <Text strong>场景提示词</Text>
          <pre className="ai-call-prompt-preview">
            {snapshot.promptText || '—'}
          </pre>
        </div>
      ),
    });
  };

  const renameVersion = async (
    version: AiCallLabPromptVersion,
    versionName: string,
  ) => {
    const nextName = versionName.trim();
    if (!selectedProfile.id || !nextName) {
      messageApi.warning('版本名称不能为空');
      return;
    }
    if (nextName === version.versionName) return;
    try {
      const saved = await updateAiCallLabPromptVersionName(
        selectedProfile.id,
        version.id,
        nextName,
      );
      setVersions((current) =>
        current.map((item) =>
          String(item.id) === String(saved.id) ? saved : item,
        ),
      );
      messageApi.success('版本名称已修改');
    } catch {
      messageApi.error('版本名称修改失败');
    }
  };

  const applyVersion = (version: AiCallLabPromptVersion) => {
    const profileId = selectedProfile.id;
    if (!profileId) return;
    Modal.confirm({
      title: `应用版本 v${version.versionNo}？`,
      content: '应用后会生成一个新的最新版本，不会覆盖原历史记录。',
      onOk: async () => {
        const saved = await applyAiCallLabPromptVersion(profileId, version.id);
        applyProfile(saved);
        messageApi.success('历史版本已应用');
      },
    });
  };

  return (
    <ListPage className="ai-call-prompt-config-page" title="AI Call 提示词配置">
      {messageContextHolder}
      <div className="ai-call-prompt-config-layout">
        <Title level={3}>AI Call 提示词配置</Title>
        <Spin spinning={loading}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Collapse
              className="ai-call-prompt-common-collapse"
              items={[
                {
                  key: 'common',
                  label: '通用沟通规则模板',
                  extra: (
                    <Text type="secondary">
                      仅替换当前场景的「三、沟通规则」
                    </Text>
                  ),
                  children: (
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <TextArea
                        value={commonPrompt}
                        rows={8}
                        maxLength={20_000}
                        showCount
                        onChange={(event) => {
                          setCommonPrompt(event.target.value);
                          setCommonDirty(true);
                        }}
                      />
                      <Space>
                        <Button
                          type="primary"
                          loading={savingCommon}
                          onClick={async () => {
                            setSavingCommon(true);
                            try {
                              const saved =
                                await saveAiCallLabPromptCommonConfig(
                                  commonPrompt.trim(),
                                );
                              setCommonPrompt(saved.content || '');
                              setCommonDirty(false);
                              messageApi.success('通用沟通规则已保存');
                            } finally {
                              setSavingCommon(false);
                            }
                          }}
                        >
                          保存通用沟通规则
                        </Button>
                        <Button onClick={handleApplyCommon}>
                          应用到当前场景
                        </Button>
                      </Space>
                    </Space>
                  ),
                },
              ]}
            />

            <TableCard title="场景选择" className="ai-call-prompt-config-card">
              <div className="ai-call-prompt-scene-toolbar">
                <Select
                  aria-label="选择场景"
                  className="ai-call-prompt-scene-select"
                  value={
                    selectedProfile.id ? profileKey(selectedProfile) : undefined
                  }
                  placeholder="请选择场景"
                  options={profiles.map((profile) => ({
                    value: profileKey(profile),
                    label: `${profile.name} · ${profile.sceneCode}`,
                  }))}
                  onChange={(key) => {
                    const profile = profiles.find(
                      (item) => profileKey(item) === key,
                    );
                    if (profile)
                      confirmSceneDiscard(() => {
                        setCreateOrigin(null);
                        applyProfile(profile);
                      });
                  }}
                />
                <Button
                  icon={
                    selectedProfile.id ? <PlusOutlined /> : <CloseOutlined />
                  }
                  onClick={() => {
                    if (!selectedProfile.id) {
                      const origin = createOrigin || profiles[0];
                      if (origin) applyProfile(origin);
                      setCreateOrigin(null);
                      return;
                    }
                    confirmSceneDiscard(() => {
                      setCreateOrigin(selectedProfile);
                      applyProfile(emptyProfile);
                    });
                  }}
                >
                  {selectedProfile.id ? '新建场景' : '取消新建'}
                </Button>
                <Button
                  aria-label="刷新"
                  icon={<ReloadOutlined />}
                  onClick={() => void loadData()}
                />
              </div>
            </TableCard>

            <TableCard
              title={selectedProfile.name || '新建场景'}
              className="ai-call-prompt-config-card"
              extra={
                <Space size={8}>
                  <Button
                    aria-label="预览提示词"
                    icon={<EyeOutlined />}
                    loading={previewLoading}
                    onClick={() => void handlePreview()}
                  >
                    预览
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => void handleSaveProfile()}
                  >
                    保存场景配置
                  </Button>
                </Space>
              }
            >
              <div className="ai-call-prompt-form">
                <div className="ai-call-prompt-form-grid">
                  <div className="ai-call-prompt-field">
                    <label htmlFor="prompt-scene-name">场景名称</label>
                    <Input
                      id="prompt-scene-name"
                      value={selectedProfile.name}
                      maxLength={100}
                      onChange={(event) =>
                        updateSelectedProfile({ name: event.target.value })
                      }
                    />
                  </div>
                  <div className="ai-call-prompt-field">
                    <label htmlFor="prompt-scene-code">场景编码</label>
                    <Input
                      id="prompt-scene-code"
                      value={selectedProfile.sceneCode}
                      maxLength={64}
                      onChange={(event) =>
                        updateSelectedProfile({ sceneCode: event.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="ai-call-prompt-field">
                  <div className="ai-call-prompt-field-title">
                    <Text strong>开场白</Text>
                    <Button
                      size="small"
                      loading={aiLoading && aiTarget === 'opening'}
                      onClick={() => void runAiOptimize('opening')}
                    >
                      AI 生成 / 优化
                    </Button>
                  </div>
                  <VariableEditor
                    value={selectedProfile.openingMessage || ''}
                    variables={variables}
                    onAddVariable={() => setVariableModalOpen(true)}
                    onChange={(value) =>
                      updateSelectedProfile({ openingMessage: value })
                    }
                  />
                </div>

                <div className="ai-call-prompt-product-summary">
                  <div className="ai-call-prompt-product-summary-header">
                    <span className="ai-call-prompt-product-step">4</span>
                    <Text strong>产品&amp;服务总结</Text>
                    <DatabaseOutlined />
                  </div>
                  <div className="ai-call-prompt-product-summary-body">
                    <div className="ai-call-prompt-product-intro">
                      <div>
                        <label htmlFor="prompt-product-info">
                          核心内容提取自关联知识库
                        </label>
                        <Text type="secondary">
                          可从当前场景关联的知识资料中提取，也可手动编辑产品与服务要点，供
                          AI 外呼时进行事实参考。
                        </Text>
                      </div>
                      {canManageKnowledge ? (
                        <Button
                          type="primary"
                          icon={<FileTextOutlined />}
                          aria-label="从知识库一键提取"
                          loading={productDraftLoading}
                          disabled={!selectedProfile.id}
                          onClick={() => void handleExtractProductInfo()}
                        >
                          从知识库一键提取
                        </Button>
                      ) : null}
                    </div>
                    <TextArea
                      id="prompt-product-info"
                      value={selectedProfile.productInfo || ''}
                      rows={8}
                      maxLength={20_000}
                      showCount
                      onChange={(event) =>
                        updateSelectedProfile({
                          productInfo: event.target.value,
                        })
                      }
                      placeholder="产品事实、适用客户、核心能力、价值和不能承诺的内容"
                    />
                  </div>
                </div>

                <div className="ai-call-prompt-field">
                  <div className="ai-call-prompt-field-title">
                    <div>
                      <Text strong>场景提示词</Text>
                      <div>
                        <Text type="secondary">
                          新建场景的二至六节会填入通用示例，不来自知识资料，请按实际场景修改。
                        </Text>
                      </div>
                    </div>
                    <Button
                      size="small"
                      loading={aiLoading && aiTarget === 'scenePrompt'}
                      onClick={() => void runAiOptimize('scenePrompt')}
                    >
                      AI 生成 / 优化
                    </Button>
                  </div>
                  <VariableEditor
                    value={selectedProfile.promptText || ''}
                    variables={variables}
                    minHeight={360}
                    onAddVariable={() => setVariableModalOpen(true)}
                    onChange={(value) =>
                      updateSelectedProfile({ promptText: value })
                    }
                  />
                </div>

                <div className="ai-call-prompt-field">
                  <div className="ai-call-prompt-field-title">
                    <Text strong>业务变量</Text>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setVariableModalOpen(true)}
                    >
                      添加变量
                    </Button>
                  </div>
                  <div className="ai-call-prompt-variable-list">
                    {variables.length ? (
                      variables.map((variable) => (
                        <Tag
                          key={variable.key}
                          closable
                          onClose={(event) => {
                            event.preventDefault();
                            deleteVariable(variable);
                          }}
                        >
                          {variable.label} · {variable.key}
                        </Tag>
                      ))
                    ) : (
                      <Text type="secondary">
                        暂无变量。变量会映射为创建任务时上传名单的中文表头。
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            </TableCard>

            <TableCard
              title={`历史版本（${selectedProfile.versionCount ?? versions.length}）`}
              className="ai-call-prompt-config-card"
            >
              {versions.length ? (
                <List
                  dataSource={versions}
                  renderItem={(version) => (
                    <List.Item
                      actions={[
                        <Button
                          key="detail"
                          type="link"
                          onClick={() => void showVersion(version)}
                        >
                          查看详情
                        </Button>,
                        <Button
                          key="compare"
                          type="link"
                          onClick={() => void showVersion(version, true)}
                        >
                          对比当前
                        </Button>,
                        ...(version.versionNo === selectedProfile.versionNo
                          ? []
                          : [
                              <Button
                                key="apply"
                                type="link"
                                onClick={() => applyVersion(version)}
                              >
                                应用此版本
                              </Button>,
                            ]),
                        <Button
                          key="delete"
                          type="link"
                          danger
                          disabled={
                            version.versionNo === selectedProfile.versionNo
                          }
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const profileId = selectedProfile.id;
                            if (!profileId) return;
                            Modal.confirm({
                              title: `删除版本 v${version.versionNo}？`,
                              onOk: async () => {
                                await deleteAiCallLabPromptVersion(
                                  profileId,
                                  version.id,
                                );
                                await loadVersions(profileId);
                              },
                            });
                          }}
                        >
                          删除
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag
                              color={
                                version.versionNo === selectedProfile.versionNo
                                  ? 'blue'
                                  : undefined
                              }
                            >
                              v{version.versionNo}
                            </Tag>
                            <Text
                              strong
                              editable={{
                                tooltip: '编辑版本名称',
                                maxLength: 100,
                                onChange: (value) =>
                                  void renameVersion(version, value),
                              }}
                            >
                              {version.versionName || selectedProfile.name}
                            </Text>
                            <Tag>
                              {creationMethodText[version.creationMethod] ||
                                version.creationMethod}
                            </Tag>
                          </Space>
                        }
                        description={`${version.createdByName || '系统'} · ${new Date(version.createdAt).toLocaleString()}`}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description={
                    selectedProfile.id ? '暂无历史版本' : '保存场景后生成版本'
                  }
                />
              )}
            </TableCard>
          </Space>
        </Spin>
      </div>

      <Modal
        title="添加业务变量"
        open={variableModalOpen}
        onOk={addVariable}
        onCancel={() => setVariableModalOpen(false)}
        okText="添加"
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input
            addonBefore="中文名称"
            placeholder="例如：公司名"
            value={variableDraft.label}
            onChange={(event) =>
              setVariableDraft((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
          />
          <Input
            addonBefore="变量标识"
            placeholder="例如：companyName"
            value={variableDraft.key}
            onChange={(event) =>
              setVariableDraft((current) => ({
                ...current,
                key: event.target.value,
              }))
            }
          />
        </Space>
      </Modal>

      <Modal
        width={900}
        title="产品与服务知识草稿"
        open={Boolean(productDraft)}
        onCancel={() => setProductDraft(null)}
        footer={[
          <Button key="discard" onClick={() => setProductDraft(null)}>
            放弃
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              if (!productDraft) return;
              updateSelectedProfile({ productInfo: productDraft.draftText });
              setKnowledgeSnapshotHash(productDraft.versionSnapshotHash);
              setProductDraft(null);
            }}
          >
            应用到产品 / 服务信息
          </Button>,
        ]}
      >
        {productDraft ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              title="这是待确认草稿，不会自动保存；请核对来源与冲突后再应用。"
            />
            <TextArea
              aria-label="产品与服务草稿"
              value={productDraft.draftText}
              rows={10}
              maxLength={20_000}
              showCount
              onChange={(event) =>
                setProductDraft((current) =>
                  current
                    ? { ...current, draftText: event.target.value }
                    : current,
                )
              }
            />
            {productDraft.sourceDocuments?.length ? (
              <div className="ai-call-product-draft-documents">
                <Text strong>本次参与提取资料</Text>
                <Space wrap>
                  {productDraft.sourceDocuments.map((document) => (
                    <Tag key={document.versionId}>
                      {document.sourceFilename} · v{document.versionNo}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}
            {productDraft.conflicts.map((conflict) => (
              <Alert
                key={`${conflict.topic}-${conflict.description}-${conflict.sourceChunkIds.join(',')}`}
                type="warning"
                showIcon
                title={`待确认冲突：${conflict.topic}`}
                description={conflict.description}
              />
            ))}
            <List
              className="ai-call-product-draft-sources"
              size="small"
              header={<Text strong>结论来源（模型实际引用）</Text>}
              dataSource={productDraft.sources}
              renderItem={(source) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Text type="secondary">提取结论：</Text>
                        {source.claim}
                      </span>
                    }
                    description={
                      <Space orientation="vertical" size={2}>
                        <Text type="secondary">
                          来源文件：{source.sourceFilename} · v
                          {source.versionNo}
                          {source.pageNo ? ` · 第 ${source.pageNo} 页` : ''}
                          {source.sectionPath ? ` · ${source.sectionPath}` : ''}
                        </Text>
                        <Text>
                          <Text type="secondary">原文片段：</Text>
                          {source.excerpt}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Space>
        ) : null}
      </Modal>

      <Modal
        width={900}
        title={
          aiTarget === 'opening'
            ? '开场白 AI 候选内容'
            : '场景提示词 AI 候选内容'
        }
        open={Boolean(aiTarget && aiCandidate)}
        onCancel={closeAiModal}
        footer={[
          <Button key="cancel" onClick={closeAiModal}>
            取消
          </Button>,
          <Button
            key="retry"
            loading={aiLoading}
            onClick={() =>
              aiTarget && void runAiOptimize(aiTarget, aiInstruction)
            }
          >
            按要求重新优化
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              updateSelectedProfile(
                aiTarget === 'opening'
                  ? { openingMessage: aiCandidate }
                  : { promptText: aiCandidate },
              );
              closeAiModal();
            }}
          >
            采用候选内容
          </Button>,
        ]}
      >
        <div className="ai-call-prompt-compare">
          <div>
            <Text strong>原内容</Text>
            <pre>
              {aiTarget === 'opening'
                ? selectedProfile.openingMessage
                : selectedProfile.promptText}
            </pre>
          </div>
          <div>
            <Text strong>候选内容</Text>
            <pre>{aiCandidate}</pre>
          </div>
        </div>
        <TextArea
          value={aiInstruction}
          onChange={(event) => setAiInstruction(event.target.value)}
          placeholder="可选：填写再次优化要求"
          rows={3}
        />
      </Modal>
    </ListPage>
  );
};

export default AiCallLabPromptConfigPage;
