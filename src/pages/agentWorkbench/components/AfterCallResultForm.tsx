import { Alert, Button, DatePicker, Form, Input, Radio, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import * as React from 'react';
import { useState } from 'react';
import type {
  AttemptResult,
  CustomerClassification,
  CustomerLowValueReason,
} from '@/services/ruoyi/agent-console';
import './AfterCallResultForm.css';

export type AfterCallResultValues = {
  classification?: CustomerClassification;
  lowValueReason?: CustomerLowValueReason;
  conclusion?: string;
  remark?: string;
  scheduleFollowUp: boolean;
  nextFollowUpAt?: string;
};

type FormValues = Omit<AfterCallResultValues, 'nextFollowUpAt'> & {
  nextFollowUpAt?: Dayjs;
};

type AfterCallResultFormProps = {
  contactResult?: AttemptResult;
  currentClassification?: CustomerClassification | null;
  conclusionDraft?: string;
  footerNote?: React.ReactNode;
  includeConverted?: boolean;
  includeInvalidContactReason?: boolean;
  initialRemark?: string;
  onSubmit: (values: AfterCallResultValues) => Promise<void>;
  submitText: string;
};

const classificationLabels: Record<CustomerClassification, string> = {
  interested: '有意向',
  nurturing: '持续跟进',
  low_value: '低价值',
  converted: '已转化',
};

const lowValueReasonLabels: Record<CustomerLowValueReason, string> = {
  explicit_rejection: '明确拒绝',
  no_current_need: '暂无需求',
  customer_mismatch: '客户不匹配',
  non_target_customer: '非目标客户',
  invalid_contact: '联系方式无效',
  other: '其他',
};

const contactResultLabels: Record<AttemptResult, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  rejected: '客户拒接',
  invalid_contact: '联系方式无效',
  technical_failure: '技术失败',
};

const AfterCallResultForm = ({
  contactResult = 'connected',
  currentClassification,
  conclusionDraft,
  footerNote,
  includeConverted = true,
  includeInvalidContactReason = true,
  initialRemark,
  onSubmit,
  submitText,
}: AfterCallResultFormProps) => {
  const [form] = Form.useForm<FormValues>();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const classification = Form.useWatch('classification', form);
  const scheduleFollowUp = Form.useWatch('scheduleFollowUp', form);
  const connected = contactResult === 'connected';
  const canSchedule = !['low_value', 'converted'].includes(
    classification || currentClassification || '',
  );

  return (
    <Form
      className="agent-after-call-result-form"
      form={form}
      layout="vertical"
      initialValues={{
        classification: connected
          ? currentClassification || undefined
          : undefined,
        conclusion: connected ? conclusionDraft || '' : undefined,
        remark: connected ? undefined : initialRemark || '',
        scheduleFollowUp: false,
      }}
      onValuesChange={(changed) => {
        setError('');
        if (
          changed.classification &&
          ['low_value', 'converted'].includes(changed.classification)
        ) {
          form.setFieldsValue({
            scheduleFollowUp: false,
            nextFollowUpAt: undefined,
          });
        }
      }}
      onFinish={async (values) => {
        setSubmitting(true);
        setError('');
        try {
          await onSubmit({
            ...values,
            conclusion: values.conclusion?.trim() || undefined,
            remark: values.remark?.trim() || undefined,
            nextFollowUpAt: values.nextFollowUpAt?.toISOString(),
          });
        } catch (submitError) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : '话后结果提交失败，请保留当前内容后重试',
          );
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {!connected ? (
        <Alert
          type="info"
          showIcon
          title={`本次联系结果：${contactResultLabels[contactResult]}`}
          description="本次未形成有效沟通，客户分类保持不变。"
        />
      ) : null}
      {connected ? (
        <>
          <Form.Item
            label="客户分类"
            name="classification"
            rules={[{ required: true, message: '请选择客户分类' }]}
          >
            <Select
              options={Object.entries(classificationLabels)
                .filter(([value]) => includeConverted || value !== 'converted')
                .map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          {classification === 'low_value' ? (
            <Form.Item
              label="低价值原因"
              name="lowValueReason"
              rules={[{ required: true, message: '请选择低价值原因' }]}
            >
              <Select
                options={Object.entries(lowValueReasonLabels)
                  .filter(
                    ([value]) =>
                      includeInvalidContactReason ||
                      value !== 'invalid_contact',
                  )
                  .map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          ) : null}
          {conclusionDraft ? (
            <Alert
              type="info"
              showIcon
              title="AI 沟通摘要（请确认或修改）"
              description={conclusionDraft}
            />
          ) : null}
          <Form.Item
            label="沟通结论"
            name="conclusion"
            rules={[
              { required: true, whitespace: true, message: '请填写沟通结论' },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={4000}
              placeholder="填写本次沟通形成的明确结论"
            />
          </Form.Item>
        </>
      ) : (
        <Form.Item
          label="处理备注"
          name="remark"
          rules={[
            { required: true, whitespace: true, message: '请填写处理备注' },
            {
              validator: (_, value: string | undefined) =>
                contactResult !== 'technical_failure' ||
                value?.trim() !== initialRemark?.trim()
                  ? Promise.resolve()
                  : Promise.reject(new Error('请补充技术失败原因')),
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            placeholder="记录本次未接通或失败情况"
          />
        </Form.Item>
      )}
      <Form.Item
        label="后续安排"
        name="scheduleFollowUp"
        rules={[{ required: true, message: '请选择是否安排回访' }]}
      >
        <Radio.Group
          options={[
            {
              label: connected ? '安排下次回访' : '安排再次回访',
              value: true,
              disabled: !canSchedule,
            },
            { label: '暂不安排回访', value: false },
          ]}
        />
      </Form.Item>
      {!canSchedule ? (
        <Alert
          type="warning"
          showIcon
          title="当前分类不能安排回访，如需继续联系请先调整为有意向或持续跟进。"
        />
      ) : null}
      {scheduleFollowUp ? (
        <Form.Item
          label="计划回访时间"
          name="nextFollowUpAt"
          rules={[
            { required: true, message: '请选择计划回访时间' },
            {
              validator: (_, value: Dayjs | undefined) =>
                !value || value.isAfter(dayjs())
                  ? Promise.resolve()
                  : Promise.reject(new Error('计划回访时间需晚于当前时间')),
            },
          ]}
        >
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            style={{ width: '100%' }}
            disabledDate={(current) => current.isBefore(dayjs(), 'day')}
          />
        </Form.Item>
      ) : null}
      <div className="agent-after-call-result-footer">
        <div>{footerNote}</div>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {submitText}
        </Button>
      </div>
    </Form>
  );
};

export default AfterCallResultForm;
