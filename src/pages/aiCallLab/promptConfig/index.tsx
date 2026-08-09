import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Collapse,
  Empty,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListPage,
  TableCard,
} from '@/components/ListLayout';
import {
  type AiCallLabPromptComponent,
  type AiCallLabPromptProfile,
  getAiCallLabPromptComponents,
  getAiCallLabPromptProfiles,
  saveAiCallLabPromptProfile,
} from '@/services/ruoyi/ai-call-lab';
import './index.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

const emptyProfile: AiCallLabPromptProfile = {
  name: '',
  sceneCode: '',
  providerKey: 'static_profile',
  promptText: '',
  openingMessage: '',
};

const providerOptions = [
  { label: '固定配置', value: 'static_profile' },
  { label: '业务查询', value: 'business_query' },
];

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const providerLabel = (providerKey?: string) => {
  if (providerKey === 'business_query') return '业务查询';
  if (providerKey === 'static_profile') return '固定配置';
  return providerKey || '-';
};

type PromptSection = {
  key: string;
  label: string;
  content: string;
  tag?: string;
};

const getComponent = (
  components: AiCallLabPromptComponent[],
  componentKey: string,
) => components.find((item) => item.componentKey === componentKey);

const buildPromptSections = (
  profile: AiCallLabPromptProfile,
  components: AiCallLabPromptComponent[],
): PromptSection[] => {
  const commonKeys = ['platform_constraints', 'handoff_capability'];
  const usedKeys = new Set([...commonKeys, 'call_end_tool']);
  const isBusinessQuery = profile.providerKey === 'business_query';
  const openingMessage = profile.openingMessage?.trim();
  const promptText = profile.promptText?.trim();
  const sections: PromptSection[] = [
    ...commonKeys
      .map((key) => getComponent(components, key))
      .filter((item): item is AiCallLabPromptComponent => Boolean(item))
      .map((component) => ({
        key: component.componentKey,
        label: component.name || component.componentKey,
        content: component.content || '-',
        tag: '通用提示词',
      })),
    ...components
      .filter((component) => !usedKeys.has(component.componentKey))
      .map((component) => ({
        key: component.componentKey,
        label: component.name || component.componentKey,
        content: component.content || '-',
      })),
    {
      key: 'business_content',
      label: '业务话术',
      content: isBusinessQuery
        ? '{{业务话术}}'
        : promptText || '{{固定提示词未填写}}',
    },
    {
      key: 'opening_message',
      label: '开场白约束',
      content: isBusinessQuery
        ? '通话开始后，系统会触发你主动开场。请先自然说出这句开场白：{{开场白}}'
        : `通话开始后，系统会触发你主动开场。请先自然说出这句开场白：${
            openingMessage || '{{固定开场白未填写}}'
          }`,
    },
  ];
  const callEnd = getComponent(components, 'call_end_tool');
  if (callEnd) {
    sections.push({
      key: callEnd.componentKey,
      label: callEnd.name || callEnd.componentKey,
      content: callEnd.content || '-',
      tag: '通用提示词',
    });
  }
  return sections;
};

const AiCallLabPromptConfigPage = () => {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [profiles, setProfiles] = useState<AiCallLabPromptProfile[]>([]);
  const [components, setComponents] = useState<AiCallLabPromptComponent[]>([]);
  const [selectedProfile, setSelectedProfile] =
    useState<AiCallLabPromptProfile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResult, componentResult] = await Promise.all([
        getAiCallLabPromptProfiles(),
        getAiCallLabPromptComponents(),
      ]);
      const nextProfiles = profileResult.rows;
      setProfiles(nextProfiles);
      setComponents(componentResult.rows);
      setSelectedProfile(nextProfiles[0] || emptyProfile);
    } catch {
      setProfiles([]);
      setComponents([]);
      setSelectedProfile(emptyProfile);
      messageApi.error('提示词配置加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const promptSections = useMemo(
    () => buildPromptSections(selectedProfile, components),
    [selectedProfile, components],
  );

  const updateSelectedProfile = (patch: Partial<AiCallLabPromptProfile>) => {
    setSelectedProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleNewProfile = () => {
    setSelectedProfile(emptyProfile);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const providerKey = selectedProfile.providerKey || 'static_profile';
      await saveAiCallLabPromptProfile({
        id: selectedProfile.id,
        name: selectedProfile.name.trim(),
        sceneCode: selectedProfile.sceneCode.trim(),
        providerKey,
        promptText:
          providerKey === 'business_query'
            ? null
            : selectedProfile.promptText?.trim() || '',
        openingMessage:
          providerKey === 'business_query'
            ? null
            : selectedProfile.openingMessage?.trim() || '',
      });
      messageApi.success('提示词配置已保存');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPage
      className="ai-call-prompt-config-page"
      title="AI Call 提示词配置"
    >
      {messageContextHolder}
      <div className="ai-call-prompt-config-layout">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            AI Call 提示词配置
          </Title>
        </div>
        <div className="ai-call-prompt-config-grid">
          <TableCard
            className="ai-call-prompt-config-card"
            title="场景配置"
            extra={
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void loadData()}
              >
                刷新
              </Button>
            }
          >
            <Spin spinning={loading}>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {profiles.length ? (
                  profiles.map((profile) => {
                    const selected =
                      String(profile.id ?? '') ===
                        String(selectedProfile.id ?? '') &&
                      profile.sceneCode === selectedProfile.sceneCode;
                    return (
                      <Button
                        key={`${profile.id ?? profile.sceneCode}`}
                        className="ai-call-prompt-profile-button"
                        type={selected ? 'primary' : 'default'}
                        block
                        style={{ height: 'auto', textAlign: 'left' }}
                        onClick={() => setSelectedProfile(profile)}
                      >
                        <Space
                          orientation="vertical"
                          size={2}
                          style={{ width: '100%', alignItems: 'flex-start' }}
                        >
                          <Text strong>{profile.name}</Text>
                          <Text type={selected ? undefined : 'secondary'}>
                            {profile.sceneCode}
                          </Text>
                          <Tag>{providerLabel(profile.providerKey)}</Tag>
                        </Space>
                      </Button>
                    );
                  })
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Space>
            </Spin>
          </TableCard>

          <TableCard
            className="ai-call-prompt-config-card"
            title="配置内容"
            extra={
              <Space>
                <Button icon={<PlusOutlined />} onClick={handleNewProfile}>
                  新建
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => void handleSave()}
                >
                  保存
                </Button>
              </Space>
            }
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <div style={fieldStyle}>
                <Text strong>名称</Text>
                <Input
                  value={selectedProfile.name}
                  maxLength={100}
                  onChange={(event) =>
                    updateSelectedProfile({ name: event.target.value })
                  }
                />
              </div>
              <div style={fieldStyle}>
                <Text strong>场景编码</Text>
                <Input
                  value={selectedProfile.sceneCode}
                  maxLength={64}
                  onChange={(event) =>
                    updateSelectedProfile({ sceneCode: event.target.value })
                  }
                />
              </div>
              <div style={fieldStyle}>
                <Text strong>提示词来源</Text>
                <Select
                  value={selectedProfile.providerKey || 'static_profile'}
                  options={providerOptions}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    updateSelectedProfile({ providerKey: value })
                  }
                />
              </div>
              <div style={fieldStyle}>
                <Text strong>开场白</Text>
                <TextArea
                  value={selectedProfile.openingMessage || ''}
                  rows={3}
                  disabled={selectedProfile.providerKey === 'business_query'}
                  onChange={(event) =>
                    updateSelectedProfile({
                      openingMessage: event.target.value,
                    })
                  }
                />
              </div>
              <div style={fieldStyle}>
                <Text strong>提示词</Text>
                <TextArea
                  value={selectedProfile.promptText || ''}
                  rows={8}
                  disabled={selectedProfile.providerKey === 'business_query'}
                  onChange={(event) =>
                    updateSelectedProfile({ promptText: event.target.value })
                  }
                />
              </div>
            </Space>
          </TableCard>

          <TableCard
            className="ai-call-prompt-config-card ai-call-prompt-structure-card"
            title="提示词结构"
          >
            <Title level={5} style={{ marginTop: 0 }}>
              {selectedProfile.name || '未命名场景'}
            </Title>
            <Collapse
              activeKey={promptSections.map((item) => item.key)}
              items={promptSections.map((section, index) => ({
                key: section.key,
                label: (
                  <Space>
                    <Text>{`${String(index + 1).padStart(2, '0')}. ${
                      section.label
                    }`}</Text>
                    {section.tag ? <Tag>{section.tag}</Tag> : null}
                  </Space>
                ),
                children: (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {section.content}
                  </pre>
                ),
              }))}
            />
          </TableCard>
        </div>
      </div>
    </ListPage>
  );
};

export default AiCallLabPromptConfigPage;
