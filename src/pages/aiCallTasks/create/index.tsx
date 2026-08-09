import { history } from '@umijs/max';
import {
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Radio,
  Select,
  Space,
} from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AiCallRule } from '@/pages/aiCallRules/domain';
import { listAiCallRules } from '@/pages/aiCallRules/service';
import {
  ListPage,
  ListStack,
  TableCard,
} from '@/components/ListLayout';
import {
  type AiCallLabPromptProfile,
  type AiCallLabVoiceProfile,
  getAiCallLabPromptProfiles,
  getAiCallLabVoiceProfiles,
} from '@/services/ruoyi/ai-call-lab';
import type { AnswerMode, ExecutionMode } from '../domain';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import {
  createAiCallTask,
  createBatchValidation,
  downloadOutboundTargetTemplate,
  getValidationResult,
  retryBatchValidation,
  type SingleTargetValidationRequest,
  type ValidationRequest,
  type ValidationResult as ValidationResultData,
  validateSingleTarget,
} from '../service';
import BatchTargetUpload from './BatchTargetUpload';
import TaskConfirmation from './TaskConfirmation';
import ValidationResultPanel from './ValidationResult';
import { validateBatchTargetFile, validateExecutionPlan } from './validation';

type TaskFormValues = {
  taskName: string;
  taskMode: 'single' | 'batch';
  answerMode: AnswerMode;
  phoneNumber?: string;
  customerName?: string;
  promptKey: string;
  voice: string;
  ruleId: string;
  executionMode: ExecutionMode;
  scheduledAt?: Dayjs;
};

type SelectableVoiceProfile = AiCallLabVoiceProfile & { voice: string };

type ValidatedTask = {
  request: ValidationRequest;
  validation: ValidationResultData;
  values: TaskFormValues;
  prompt: AiCallLabPromptProfile;
  voice: SelectableVoiceProfile;
  rule: AiCallRule;
};

type BatchValidationContext = Omit<ValidatedTask, 'validation'>;

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `ai-call-task-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatRuleSummary = (rule: AiCallRule) => {
  const windows = rule.callWindows
    .map((window) => `${window.startTime}–${window.endTime}`)
    .join('、');
  return `${windows}，最多重试 ${rule.retryCount} 次`;
};

const getPromptKey = (profile: AiCallLabPromptProfile) =>
  String(profile.id ?? profile.sceneCode);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请稍后重试';

const CreateAiCallTaskPage = () => {
  const [form] = Form.useForm<TaskFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [promptProfiles, setPromptProfiles] = useState<
    AiCallLabPromptProfile[]
  >([]);
  const [voiceProfiles, setVoiceProfiles] = useState<SelectableVoiceProfile[]>(
    [],
  );
  const [rules, setRules] = useState<AiCallRule[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validatedTask, setValidatedTask] = useState<ValidatedTask>();
  const [creating, setCreating] = useState(false);
  const [batchFile, setBatchFile] = useState<File>();
  const [batchValidation, setBatchValidation] =
    useState<ValidationResultData>();
  const [batchContext, setBatchContext] = useState<BatchValidationContext>();
  const [batchPhase, setBatchPhase] = useState<'uploading' | 'validating'>();
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const creatingRef = useRef(false);
  const batchRetryingRef = useRef(false);
  const validationGenerationRef = useRef(0);
  const activeValidationIdRef = useRef<string | undefined>(undefined);
  const pollOwnerRef = useRef<symbol | null>(null);
  const taskMode = Form.useWatch('taskMode', form);
  const answerMode = Form.useWatch('answerMode', form);
  const executionMode = Form.useWatch('executionMode', form);
  const ruleId = Form.useWatch('ruleId', form);

  useEffect(() => {
    Promise.all([
      getAiCallLabPromptProfiles(),
      getAiCallLabVoiceProfiles({ availableOnly: true, pageSize: 200 }),
      listAiCallRules({
        pageNum: 1,
        pageSize: 200,
        enabled: true,
      }),
    ])
      .then(([promptResult, voiceResult, ruleResult]) => {
        const selectableVoices = voiceResult.rows.filter(
          (
            item,
          ): item is AiCallLabVoiceProfile & {
            voice: string;
          } => item.status === 'ENABLED' && Boolean(item.voice),
        );
        setPromptProfiles(promptResult.rows);
        setVoiceProfiles(selectableVoices);
        setRules(ruleResult.rows);
        form.setFieldsValue({
          taskMode: 'single',
          answerMode: 'web',
          executionMode: 'immediate',
          promptKey: promptResult.rows[0]
            ? getPromptKey(promptResult.rows[0])
            : undefined,
          voice: selectableVoices[0]?.voice,
          ruleId: ruleResult.rows[0]?.ruleId,
        } as Partial<TaskFormValues>);
      })
      .catch((error: unknown) => {
        messageApi.error(getErrorMessage(error));
      })
      .finally(() => {
        setLoadingConfig(false);
      });
  }, [form, messageApi]);

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.ruleId === ruleId),
    [ruleId, rules],
  );

  const finalizeBatchValidation = (validation: ValidationResultData) => {
    setBatchValidation(validation);
    if (validation.status === 'PASSED' && batchContext) {
      setValidatedTask({ ...batchContext, validation });
    }
  };

  useVisiblePolling({
    enabled: batchValidation?.status === 'VALIDATING',
    intervalMs: 2_000,
    onTick: async () => {
      if (!batchValidation?.validationId || pollOwnerRef.current) return;
      const validationId = batchValidation.validationId;
      const generation = validationGenerationRef.current;
      const pollOwner = Symbol(validationId);
      pollOwnerRef.current = pollOwner;
      try {
        const next = await getValidationResult(validationId);
        if (
          generation !== validationGenerationRef.current ||
          pollOwnerRef.current !== pollOwner ||
          activeValidationIdRef.current !== validationId
        ) {
          return;
        }
        finalizeBatchValidation(next);
      } catch {
        return;
      } finally {
        if (pollOwnerRef.current === pollOwner) {
          pollOwnerRef.current = null;
        }
      }
    },
  });

  const validateTask = async (values: TaskFormValues) => {
    const prompt = promptProfiles.find(
      (item) => getPromptKey(item) === values.promptKey,
    );
    const voice = voiceProfiles.find((item) => item.voice === values.voice);
    const rule = rules.find((item) => item.ruleId === values.ruleId);
    if (!prompt || !voice || !rule) {
      messageApi.error('任务配置尚未加载完成');
      return;
    }

    const scheduledAt = values.scheduledAt?.format('YYYY-MM-DD HH:mm:ss');
    const executionError = validateExecutionPlan({
      executionMode: values.executionMode,
      scheduledAt,
      rule,
    });
    if (executionError) {
      messageApi.error(executionError);
      return;
    }

    const request: ValidationRequest = {
      taskName: values.taskName.trim(),
      taskMode: values.taskMode,
      answerMode: values.taskMode === 'batch' ? 'linphone' : values.answerMode,
      promptProfileId: prompt.id === undefined ? undefined : String(prompt.id),
      sceneCode: prompt.sceneCode,
      voice: voice.voice,
      ruleId: rule.ruleId,
      executionMode: values.executionMode,
      scheduledAt,
    };

    const generation = validationGenerationRef.current + 1;
    validationGenerationRef.current = generation;
    activeValidationIdRef.current = undefined;
    pollOwnerRef.current = null;
    setValidating(true);
    try {
      if (values.taskMode === 'single') {
        const singleRequest: SingleTargetValidationRequest = {
          ...request,
          taskMode: 'single',
          ...(values.answerMode === 'linphone'
            ? { phoneNumber: values.phoneNumber?.trim() || '' }
            : {}),
          customerName: values.customerName?.trim() || undefined,
        };
        const validation = await validateSingleTarget(singleRequest);
        if (generation !== validationGenerationRef.current) return;
        if (validation.status !== 'PASSED') {
          messageApi.error(validation.errorMessage || '任务校验未通过');
          return;
        }
        setValidatedTask({
          request: singleRequest,
          validation,
          values,
          prompt,
          voice,
          rule,
        });
        return;
      }

      if (!batchFile) {
        messageApi.error('请上传完整外呼名单');
        return;
      }
      const fileError = validateBatchTargetFile(batchFile);
      if (fileError) {
        messageApi.error(fileError);
        return;
      }

      setBatchPhase('uploading');
      const validation = await createBatchValidation({
        file: batchFile,
        request: { ...request, taskMode: 'batch' },
      });
      if (generation !== validationGenerationRef.current) return;
      if (!validation.validationId) {
        throw new Error('名单校验受理响应缺少 validationId');
      }
      setBatchPhase('validating');
      activeValidationIdRef.current = validation.validationId;
      const context = { request, values, prompt, voice, rule };
      setBatchContext(context);
      setBatchValidation(validation);
      if (validation.status === 'PASSED') {
        setValidatedTask({ ...context, validation });
      }
    } catch (error) {
      if (generation === validationGenerationRef.current) {
        messageApi.error(getErrorMessage(error));
      }
    } finally {
      if (generation === validationGenerationRef.current) {
        setBatchPhase(undefined);
        setValidating(false);
      }
    }
  };

  const retryBatchSystemValidation = async () => {
    if (
      batchValidation?.status !== 'SYSTEM_ERROR' ||
      batchValidation.retryAction !== 'RETRY_VALIDATION' ||
      batchRetryingRef.current
    ) {
      return;
    }
    batchRetryingRef.current = true;
    const generation = validationGenerationRef.current;
    const validationId = batchValidation.validationId;
    pollOwnerRef.current = null;
    setValidating(true);
    try {
      const validation = await retryBatchValidation(validationId);
      if (
        generation !== validationGenerationRef.current ||
        activeValidationIdRef.current !== validationId
      ) {
        return;
      }
      finalizeBatchValidation(validation);
    } catch (error) {
      if (generation === validationGenerationRef.current) {
        messageApi.error(getErrorMessage(error));
      }
    } finally {
      if (generation === validationGenerationRef.current) {
        batchRetryingRef.current = false;
        setValidating(false);
      }
    }
  };

  const invalidateValidation = () => {
    validationGenerationRef.current += 1;
    activeValidationIdRef.current = undefined;
    pollOwnerRef.current = null;
    batchRetryingRef.current = false;
    setValidating(false);
    setBatchPhase(undefined);
    setValidatedTask(undefined);
    setBatchValidation(undefined);
    setBatchContext(undefined);
  };

  const confirmCreate = async () => {
    if (!validatedTask || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const result = await createAiCallTask(
        validatedTask.request,
        validatedTask.validation.validationId,
        createIdempotencyKey(),
      );
      history.push(`/ai-call/tasks/${result.taskId}`);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <ListPage
      breadcrumbRender={false}
      className="recov-task-create-page"
      title="新建外呼任务"
    >
      {messageContextHolder}
      <ListStack className="pb-20">
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl font-semibold">新建外呼任务</h2>
          <Button onClick={() => history.push('/ai-call/tasks')}>
            返回任务列表
          </Button>
        </div>

        <TableCard className="recov-task-create-form-card">
          <Form<TaskFormValues>
            form={form}
            layout="vertical"
            onFinish={validateTask}
            onValuesChange={(changedValues) => {
              if (changedValues.taskMode === 'batch') {
                form.setFieldValue('answerMode', 'linphone');
              }
              invalidateValidation();
            }}
          >
            <Form.Item
              label="任务名称"
              name="taskName"
              rules={[
                { required: true, whitespace: true, message: '请输入任务名称' },
              ]}
            >
              <Input maxLength={50} placeholder="请输入任务名称" />
            </Form.Item>

            <Form.Item label="外呼方式" name="taskMode">
              <Radio.Group
                options={[
                  { label: '单个客户', value: 'single' },
                  { label: '名单外呼', value: 'batch' },
                ]}
              />
            </Form.Item>

            {taskMode === 'single' ? (
              <Form.Item label="接听方式" name="answerMode">
                <Radio.Group
                  options={[
                    { label: 'Web（浏览器）', value: 'web' },
                    { label: 'Linphone（SIP）', value: 'linphone' },
                  ]}
                />
              </Form.Item>
            ) : null}

            {taskMode === 'batch' ? (
              <Form.Item label="外呼名单" required>
                <BatchTargetUpload
                  downloading={downloadingTemplate}
                  file={batchFile}
                  onDownload={async () => {
                    setDownloadingTemplate(true);
                    try {
                      await downloadOutboundTargetTemplate();
                    } catch (error) {
                      messageApi.error(getErrorMessage(error));
                    } finally {
                      setDownloadingTemplate(false);
                    }
                  }}
                  onFileChange={(file) => {
                    setBatchFile(file);
                    invalidateValidation();
                  }}
                  onFileError={(errorMessage) => {
                    messageApi.error(errorMessage);
                  }}
                />
              </Form.Item>
            ) : answerMode === 'linphone' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item
                  label="手机号"
                  name="phoneNumber"
                  rules={[
                    { required: true, message: '请输入手机号' },
                    {
                      pattern: /^1\d{10}$/,
                      message: '请输入正确的 11 位手机号',
                    },
                  ]}
                >
                  <Input maxLength={11} placeholder="请输入手机号" />
                </Form.Item>
                <Form.Item label="客户名称" name="customerName">
                  <Input maxLength={50} placeholder="请输入客户名称（选填）" />
                </Form.Item>
              </div>
            ) : (
              <Form.Item label="客户名称" name="customerName">
                <Input maxLength={50} placeholder="请输入客户名称（选填）" />
              </Form.Item>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item
                label="提示词"
                name="promptKey"
                rules={[{ required: true, message: '请选择提示词' }]}
              >
                <Select
                  loading={loadingConfig}
                  options={promptProfiles.map((profile) => ({
                    value: getPromptKey(profile),
                    label: `${profile.name} / ${profile.sceneCode}`,
                  }))}
                  placeholder="请选择提示词"
                />
              </Form.Item>
              <Form.Item
                label={
                  <Space size={4}>
                    <span>音色</span>
                    <Button
                      size="small"
                      type="link"
                      onClick={() => history.push('/ai-call/voices')}
                    >
                      前往音色管理
                    </Button>
                  </Space>
                }
                name="voice"
                rules={[{ required: true, message: '请选择音色' }]}
              >
                <Select
                  loading={loadingConfig}
                  options={voiceProfiles.map((voice) => ({
                    value: voice.voice,
                    label: voice.displayName,
                  }))}
                  placeholder="请选择音色"
                />
              </Form.Item>
            </div>

            <Form.Item
              label="呼叫规则"
              name="ruleId"
              rules={[{ required: true, message: '请选择呼叫规则' }]}
            >
              <Select
                loading={loadingConfig}
                options={rules.map((rule) => ({
                  value: rule.ruleId,
                  label: rule.ruleName,
                }))}
                placeholder="请选择呼叫规则"
              />
            </Form.Item>
            {selectedRule ? (
              <div className="-mt-4 mb-8 text-sm text-gray-500">
                {formatRuleSummary(selectedRule)}
              </div>
            ) : null}

            <Form.Item label="执行计划" name="executionMode">
              <Radio.Group
                options={[
                  { label: '立即执行', value: 'immediate' },
                  { label: '定时执行', value: 'scheduled' },
                ]}
              />
            </Form.Item>
            {executionMode === 'scheduled' ? (
              <Form.Item
                label="计划执行时间"
                name="scheduledAt"
                rules={[{ required: true, message: '请选择计划执行时间' }]}
              >
                <DatePicker
                  className="w-full"
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime
                />
              </Form.Item>
            ) : null}

            <div className="mt-2 flex justify-end">
              <Button htmlType="submit" loading={validating} type="primary">
                校验任务
              </Button>
            </div>
          </Form>
        </TableCard>

        {batchPhase === 'uploading' ? (
          <TableCard>正在上传名单</TableCard>
        ) : null}
        {batchValidation && batchValidation.status !== 'PASSED' ? (
          <TableCard>
            <ValidationResultPanel
              result={batchValidation}
              retrying={validating}
              onRetry={() => void retryBatchSystemValidation()}
            />
          </TableCard>
        ) : null}

        {validatedTask ? (
          <>
            <TableCard className="recov-toolbar-card">
              <Space orientation="vertical" size={0}>
                <strong>校验通过</strong>
                <span className="text-gray-500">
                  有效外呼对象 {validatedTask.validation.validTargetCount} 个
                </span>
              </Space>
            </TableCard>
            <TableCard>
              <TaskConfirmation
                answerMode={validatedTask.request.answerMode}
                creating={creating}
                customerName={validatedTask.values.customerName}
                executionTime={
                  validatedTask.request.executionMode === 'immediate'
                    ? '立即执行'
                    : validatedTask.request.scheduledAt || '—'
                }
                phoneNumber={validatedTask.values.phoneNumber}
                promptName={validatedTask.prompt.name}
                ruleName={validatedTask.rule.ruleName}
                ruleSummary={formatRuleSummary(validatedTask.rule)}
                sceneCode={validatedTask.prompt.sceneCode}
                taskName={validatedTask.values.taskName}
                targetCount={validatedTask.validation.validTargetCount}
                voiceName={validatedTask.voice.displayName}
                onConfirm={() => void confirmCreate()}
              />
            </TableCard>
          </>
        ) : null}
      </ListStack>
    </ListPage>
  );
};

export default CreateAiCallTaskPage;
