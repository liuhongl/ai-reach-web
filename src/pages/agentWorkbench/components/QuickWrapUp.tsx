import { Alert, Button, Flex, Input, Radio, Typography } from 'antd';
import * as React from 'react';
import { useState } from 'react';
import {
  type AfterCallWorkInput,
  type DispositionCode,
  type HandoffDto,
  submitAfterCallWork,
} from '@/services/ruoyi/agent-console';
import './QuickWrapUp.css';

const { Text, Title } = Typography;

type QuickWrapUpProps = {
  handoff: HandoffDto;
  aiSummaryDraft?: string;
  recordingStatus?: 'processing' | 'ready' | 'failed';
  abnormalReason?: string;
  submit?: (callId: string, input: AfterCallWorkInput) => Promise<unknown>;
  onSubmitted?: () => void | Promise<void>;
};

const dispositionOptions: { label: string; value: DispositionCode }[] = [
  { label: '已解决', value: 'resolved' },
  { label: '需要跟进', value: 'follow_up_required' },
  { label: '客户拒绝', value: 'customer_refused' },
  { label: '联系方式无效', value: 'invalid_contact' },
  { label: '其他', value: 'other' },
];

const QuickWrapUp = ({
  handoff,
  aiSummaryDraft,
  recordingStatus = 'processing',
  abnormalReason,
  submit = submitAfterCallWork,
  onSubmitted,
}: QuickWrapUpProps) => {
  const [disposition, setDisposition] = useState<DispositionCode>();
  const [needsFollowUp, setNeedsFollowUp] = useState<boolean>();
  const [summary, setSummary] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const chooseDisposition = (value: DispositionCode) => {
    setDisposition(value);
    if (value === 'follow_up_required') setNeedsFollowUp(true);
  };

  const handleSubmit = async () => {
    if (!disposition) {
      setErrorMessage('请选择处理结果');
      return;
    }
    if (needsFollowUp === undefined) {
      setErrorMessage('请选择是否需要跟进');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await submit(handoff.call_id, {
        handoffId: handoff.handoff_id,
        dispositionCode: disposition,
        needsFollowUp,
        summary: summary.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      await onSubmitted?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '话后结果提交失败，请重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="agent-quick-wrap-up">
      <div>
        <Title level={5}>快速话后确认</Title>
        <Text type="secondary">确认处理结果后立即恢复接听</Text>
      </div>
      {abnormalReason ? (
        <Alert type="warning" showIcon title={abnormalReason} />
      ) : null}
      {errorMessage ? (
        <Alert type="error" showIcon title={errorMessage} />
      ) : null}

      <div>
        <Text strong>处理结果</Text>
        <Radio.Group
          className="agent-wrap-up-options"
          optionType="button"
          buttonStyle="solid"
          options={dispositionOptions}
          value={disposition}
          onChange={(event) => chooseDisposition(event.target.value)}
        />
      </div>
      <div>
        <Text strong>是否需要跟进</Text>
        <Radio.Group
          className="agent-wrap-up-options"
          optionType="button"
          options={[
            { label: '需要跟进', value: true },
            { label: '无需跟进', value: false },
          ]}
          value={needsFollowUp}
          onChange={(event) => {
            setNeedsFollowUp(event.target.value);
            if (event.target.value && !disposition) {
              setDisposition('follow_up_required');
            }
          }}
        />
      </div>
      <div>
        <Text strong>摘要（选填）</Text>
        {aiSummaryDraft ? (
          <Alert
            className="agent-wrap-up-draft"
            type="info"
            title="AI 摘要草稿"
            description={aiSummaryDraft}
          />
        ) : null}
        <Input.TextArea
          aria-label="话后摘要"
          value={summary}
          placeholder="可补充人工确认内容"
          maxLength={500}
          rows={2}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>
      <Flex justify="space-between" align="center" gap="small" wrap>
        <Text type={recordingStatus === 'failed' ? 'danger' : 'secondary'}>
          {recordingStatus === 'ready'
            ? '录音已生成'
            : recordingStatus === 'failed'
              ? '录音处理异常，请联系管理员'
              : '录音处理中，不影响提交'}
        </Text>
        <Button
          type="primary"
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          提交并恢复接听
        </Button>
      </Flex>
    </div>
  );
};

export default QuickWrapUp;
