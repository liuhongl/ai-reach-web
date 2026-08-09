import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Alert, Button, Space, Spin } from 'antd';
import React, { useState } from 'react';
import type { ValidationIssue } from '../domain';
import {
  downloadValidationIssues,
  listValidationIssues,
  type ValidationResult as ValidationResultData,
} from '../service';

type ValidationResultProps = {
  result: ValidationResultData;
  retrying?: boolean;
  onRetry: () => void;
};

const ValidationResult = ({
  result,
  retrying = false,
  onRetry,
}: ValidationResultProps) => {
  const [downloading, setDownloading] = useState(false);

  if (result.status === 'VALIDATING') {
    return <Spin description="名单校验中" />;
  }

  if (result.status === 'SYSTEM_ERROR') {
    const canRetry = result.retryAction === 'RETRY_VALIDATION';
    return (
      <Alert
        showIcon
        action={
          canRetry ? (
            <Button loading={retrying} onClick={onRetry}>
              重新校验
            </Button>
          ) : undefined
        }
        description={
          <>
            <div>{result.errorMessage || '名单校验服务异常'}</div>
            {!canRetry ? <div>请重新上传完整名单</div> : null}
          </>
        }
        title="名单校验失败"
        type="error"
      />
    );
  }

  if (result.status === 'PASSED') {
    return (
      <Space orientation="vertical" size={0}>
        <strong>校验通过</strong>
        <span className="text-gray-500">
          有效外呼对象 {result.validTargetCount} 个
        </span>
      </Space>
    );
  }

  const columns: ProColumns<ValidationIssue>[] = [
    {
      title: '原文件行号',
      dataIndex: 'rowNumber',
      width: 110,
      search: false,
    },
    {
      title: '手机号',
      dataIndex: 'phoneNumber',
      width: 150,
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 140,
      search: false,
      renderText: (value) => value || '—',
    },
    {
      title: '错误类型',
      dataIndex: 'reason',
      hideInTable: true,
    },
    {
      title: '错误原因',
      dataIndex: 'reasons',
      width: 260,
      search: false,
      renderText: (value: string[]) => value.join('；'),
    },
    {
      title: '重复行号',
      dataIndex: 'duplicateRowNumbers',
      width: 140,
      search: false,
      renderText: (value?: number[]) => value?.join('、') || '—',
    },
  ];

  return (
    <Space orientation="vertical" className="w-full" size={16}>
      <Alert
        showIcon
        description="请根据问题行号修正原文件，并重新上传完整名单。"
        title={`发现 ${result.issueCount} 条问题数据`}
        type="error"
      />
      <div className="flex justify-end">
        <Button
          loading={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await downloadValidationIssues(result.validationId);
            } finally {
              setDownloading(false);
            }
          }}
        >
          下载问题明细
        </Button>
      </div>
      <ProTable<ValidationIssue>
        columns={columns}
        options={false}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async (params) => {
          const response = await listValidationIssues(result.validationId, {
            pageNum: params.current || 1,
            pageSize: params.pageSize || 20,
          });
          return {
            data: response.rows,
            total: response.total,
            success: true,
          };
        }}
        rowKey="issueId"
        search={false}
      />
    </Space>
  );
};

export default ValidationResult;
