import { Alert, Typography } from 'antd';
import * as React from 'react';
import type {
  AfterCallWorkInput,
  CustomerClassification,
  CustomerLowValueReason,
  HandoffDto,
} from '@/services/ruoyi/agent-console';
import { submitAfterCallWork } from '@/services/ruoyi/agent-console';
import AfterCallResultForm, {
  type AfterCallResultValues,
} from './AfterCallResultForm';
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

const QuickWrapUp = ({
  handoff,
  aiSummaryDraft,
  recordingStatus = 'processing',
  abnormalReason,
  submit = submitAfterCallWork,
  onSubmitted,
}: QuickWrapUpProps) => {
  const submitResult = async (values: AfterCallResultValues) => {
    await submit(handoff.call_id, {
      handoffId: handoff.handoff_id,
      classification: values.classification as Exclude<
        CustomerClassification,
        'converted'
      >,
      lowValueReason: values.lowValueReason as Exclude<
        CustomerLowValueReason,
        'invalid_contact'
      >,
      conclusion: values.conclusion || '',
      scheduleFollowUp: values.scheduleFollowUp,
      nextFollowUpAt: values.nextFollowUpAt,
      expectedVersion: handoff.follow_up_data_version ?? 0,
      idempotencyKey: `after-call-result:${handoff.call_id}`,
    });
    await onSubmitted?.();
  };

  const initialClassification =
    handoff.classification === 'converted' ? undefined : handoff.classification;

  return (
    <div className="agent-quick-wrap-up">
      <div>
        <Title level={5}>话后结果</Title>
        <Text type="secondary">确认本次沟通结论后恢复接听</Text>
      </div>
      {abnormalReason ? (
        <Alert type="warning" showIcon title={abnormalReason} />
      ) : null}
      <AfterCallResultForm
        key={handoff.call_id}
        contactResult="connected"
        currentClassification={initialClassification}
        conclusionDraft={aiSummaryDraft}
        includeConverted={false}
        includeInvalidContactReason={false}
        submitText="提交并恢复接听"
        footerNote={
          <Text type={recordingStatus === 'failed' ? 'danger' : 'secondary'}>
            {recordingStatus === 'ready'
              ? '录音已生成'
              : recordingStatus === 'failed'
                ? '录音处理异常，请联系管理员'
                : '录音处理中，不影响提交'}
          </Text>
        }
        onSubmit={submitResult}
      />
    </div>
  );
};

export default QuickWrapUp;
