import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { Button, Tooltip, theme, Upload } from 'antd';
import React from 'react';
import { validateBatchTargetFile } from './validation';

type BatchTargetUploadProps = {
  file?: File;
  downloading: boolean;
  onDownload: () => void;
  onFileChange: (file?: File) => void;
  onFileError: (errorMessage: string) => void;
};

const BatchTargetUpload = ({
  file,
  downloading,
  onDownload,
  onFileChange,
  onFileError,
}: BatchTargetUploadProps) => {
  const { token } = theme.useToken();
  const fileList: UploadFile[] = file
    ? [{ uid: 'selected-target-list', name: file.name, status: 'done' }]
    : [];
  const extensionIndex = file?.name.lastIndexOf('.') ?? -1;
  const fileName = file?.name.slice(0, extensionIndex) || file?.name;
  const fileExtension =
    extensionIndex > 0 ? file?.name.slice(extensionIndex) : '';
  const uploadProps: UploadProps = {
    accept: '.xlsx',
    beforeUpload: (nextFile) => {
      const errorMessage = validateBatchTargetFile(nextFile);
      if (errorMessage) {
        onFileError(errorMessage);
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    fileList,
    maxCount: 1,
    multiple: false,
    onChange: ({ fileList: nextFiles }) => {
      const selected = nextFiles.at(-1)?.originFileObj;
      onFileChange(selected);
    },
    showUploadList: false,
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={onDownload}
        >
          下载名单模板
        </Button>
      </div>
      {file ? (
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
              <div className="font-medium">已选择外呼名单</div>
              <Tooltip title={file.name} trigger={['hover', 'focus', 'click']}>
                <button
                  aria-label={`完整文件名：${file.name}`}
                  className="mt-1 flex w-full min-w-0 items-center border-0 bg-transparent p-0 text-left text-gray-500"
                  type="button"
                >
                  <span className="min-w-0 truncate">{fileName}</span>
                  <span className="shrink-0">{fileExtension}</span>
                  <span className="ml-2 shrink-0">· 提交校验时上传</span>
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 sm:ml-auto">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} size="small">
                重新选择
              </Button>
            </Upload>
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => onFileChange(undefined)}
            >
              移除
            </Button>
          </div>
        </div>
      ) : (
        <Upload.Dragger {...uploadProps} classNames={{ trigger: 'sm:!h-28' }}>
          <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
            <InboxOutlined style={{ fontSize: 24 }} />
          </p>
          <p style={{ marginBottom: 4 }}>上传完整外呼名单</p>
          <p className="text-gray-500" style={{ marginBottom: 0 }}>
            仅支持单个不超过 10 MB 的 xlsx；手机号必填，客户名称选填
          </p>
        </Upload.Dragger>
      )}
    </div>
  );
};

export default BatchTargetUpload;
